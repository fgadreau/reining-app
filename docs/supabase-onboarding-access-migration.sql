-- Reining App V2 onboarding access migration
-- Run this once in Supabase SQL editor for existing projects.
-- This makes account onboarding explicit:
-- - any authenticated user can create an association;
-- - the creator becomes admin of the association in the same database call;
-- - invited users can accept memberships for the invited association/role.

alter table public.associations
add column if not exists website_url text;

alter table public.associations
add column if not exists sponsor_logos jsonb not null default '[]'::jsonb;

drop function if exists public.create_association_with_owner(
  text,
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.create_association_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

create or replace function public.create_association_with_owner(
  target_id text,
  target_name text,
  target_short_name text default null,
  target_timezone text default null,
  target_logo_data_url text default null,
  target_website_url text default null,
  target_sponsor_logos jsonb default '[]'::jsonb
)
returns table (
  id text,
  name text,
  short_name text,
  timezone text,
  logo_data_url text,
  website_url text,
  sponsor_logos jsonb
) as $$
declare
  created_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if nullif(btrim(target_id), '') is null then
    raise exception 'Association id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(target_name), '') is null then
    raise exception 'Association name is required'
      using errcode = '22023';
  end if;

  insert into public.associations (
    id,
    name,
    short_name,
    timezone,
    logo_data_url,
    website_url,
    sponsor_logos
  )
  values (
    btrim(target_id),
    btrim(target_name),
    nullif(btrim(target_short_name), ''),
    nullif(btrim(target_timezone), ''),
    nullif(target_logo_data_url, ''),
    nullif(btrim(target_website_url), ''),
    coalesce(target_sponsor_logos, '[]'::jsonb)
  )
  returning associations.id into created_id;

  insert into public.association_memberships (
    user_id,
    association_id,
    role
  )
  values (
    auth.uid(),
    created_id,
    'admin'
  )
  on conflict (user_id, association_id, role) do nothing;

  return query
  select
    a.id,
    a.name,
    a.short_name,
    a.timezone,
    a.logo_data_url,
    a.website_url,
    a.sponsor_logos
  from public.associations a
  where a.id = created_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.create_association_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;

drop policy if exists "Authenticated users can create associations" on public.associations;
create policy "Authenticated users can create associations"
on public.associations for insert to authenticated
with check (true);

drop policy if exists "Admins and invited users can insert memberships" on public.association_memberships;
create policy "Admins and invited users can insert memberships"
on public.association_memberships for insert to authenticated
with check (
  public.current_user_can_admin_association(association_id)
  or (
    user_id = auth.uid()
    and role = 'admin'
    and not public.association_has_memberships(association_id)
  )
  or (
    user_id = auth.uid()
    and public.current_user_has_pending_invitation(association_id, role)
  )
);

create or replace function public.accept_association_invitation(
  target_token text
)
returns table (
  invitation_id uuid,
  association_id text,
  invitation_role text,
  membership_id uuid,
  invitation_status text
) as $$
declare
  target_invitation public.association_invitations%rowtype;
  target_membership_id uuid;
  current_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if nullif(btrim(target_token), '') is null then
    raise exception 'Invitation token is required'
      using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(u.email), ''), nullif(btrim(auth.email()), ''))
  into current_user_email
  from auth.users u
  where u.id = auth.uid();

  if current_user_email is null then
    raise exception 'Authenticated user email is required'
      using errcode = '28000';
  end if;

  select *
  into target_invitation
  from public.association_invitations i
  where i.token = btrim(target_token)
  limit 1
  for update;

  if target_invitation.id is null then
    raise exception 'Invitation introuvable. Verifie le lien d''invitation.'
      using errcode = '22023';
  end if;

  if lower(target_invitation.email) <> lower(current_user_email) then
    raise exception 'Cette invitation est liee a un autre courriel. Connecte-toi avec le courriel invite.'
      using errcode = '28000';
  end if;

  if target_invitation.status = 'cancelled' then
    raise exception 'Cette invitation a ete annulee.'
      using errcode = '22023';
  end if;

  insert into public.association_memberships (
    user_id,
    association_id,
    role
  )
  values (
    auth.uid(),
    target_invitation.association_id,
    target_invitation.role
  )
  on conflict (user_id, association_id, role) do nothing
  returning id into target_membership_id;

  if target_membership_id is null then
    select m.id
    into target_membership_id
    from public.association_memberships m
    where m.user_id = auth.uid()
      and m.association_id = target_invitation.association_id
      and m.role = target_invitation.role
    limit 1;
  end if;

  update public.association_invitations
  set
    status = 'accepted',
    accepted_by = auth.uid(),
    accepted_at = now()
  where id = target_invitation.id;

  return query
  select
    target_invitation.id,
    target_invitation.association_id,
    target_invitation.role,
    target_membership_id,
    'accepted'::text;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.accept_association_invitation(text)
to authenticated;

create or replace function public.accept_pending_association_invitations()
returns table (
  invitation_id uuid,
  association_id text,
  invitation_role text,
  membership_id uuid,
  invitation_status text
) as $$
declare
  target_invitation public.association_invitations%rowtype;
  target_membership_id uuid;
  current_user_email text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  select coalesce(nullif(btrim(u.email), ''), nullif(btrim(auth.email()), ''))
  into current_user_email
  from auth.users u
  where u.id = auth.uid();

  if current_user_email is null then
    raise exception 'Authenticated user email is required'
      using errcode = '28000';
  end if;

  for target_invitation in
    select *
    from public.association_invitations i
    where lower(i.email) = lower(current_user_email)
      and i.status = 'pending'
    order by i.created_at
    for update
  loop
    target_membership_id := null;

    insert into public.association_memberships (
      user_id,
      association_id,
      role
    )
    values (
      auth.uid(),
      target_invitation.association_id,
      target_invitation.role
    )
    on conflict (user_id, association_id, role) do nothing
    returning id into target_membership_id;

    if target_membership_id is null then
      select m.id
      into target_membership_id
      from public.association_memberships m
      where m.user_id = auth.uid()
        and m.association_id = target_invitation.association_id
        and m.role = target_invitation.role
      limit 1;
    end if;

    update public.association_invitations
    set
      status = 'accepted',
      accepted_by = auth.uid(),
      accepted_at = now()
    where id = target_invitation.id;

    return query
    select
      target_invitation.id,
      target_invitation.association_id,
      target_invitation.role,
      target_membership_id,
      'accepted'::text;
  end loop;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.accept_pending_association_invitations()
to authenticated;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception
  when others then
    null;
end $$;
