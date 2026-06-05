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
