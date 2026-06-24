-- HSP / ShowScore auth profile alignment.
-- Run this in Supabase before deploying the matching JS changes.

-- Backfill user_id for older HSP profiles where the auth user can be matched
-- by email.
update public.user_profiles p
set user_id = u.id
from auth.users u
where p.user_id is null
  and p.email is not null
  and lower(u.email) = lower(p.email);

-- Backfill email for profiles that have a linked auth user but no local email.
update public.user_profiles p
set email = lower(u.email)
from auth.users u
where (p.email is null or p.email = '')
  and u.id = coalesce(p.user_id, p.id);

-- Repair memberships if the project is using standalone ShowScore's base table.
-- In shared HSP, association_memberships is a view over organization_members,
-- so the HSP branch repairs the base table directly.
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'association_memberships'
      and table_type = 'BASE TABLE'
  ) then
    update public.association_memberships m
    set user_id = p.user_id
    from public.user_profiles p
    where p.user_id is not null
      and m.user_id = p.id
      and p.id <> p.user_id
      and not exists (
        select 1
        from public.association_memberships existing
        where existing.user_id = p.user_id
          and existing.association_id = m.association_id
          and existing.role = m.role
      );
  elsif to_regclass('public.organization_members') is not null then
    update public.organization_members om
    set user_id = p.id
    from public.user_profiles p
    where p.user_id is not null
      and om.user_id = p.user_id
      and p.id <> p.user_id
      and not exists (
        select 1
        from public.organization_members existing
        where existing.user_id = p.id
          and existing.organization_id = om.organization_id
      );
  end if;
end;
$$;

-- Return the auth user id to ShowScore while preserving the standalone
-- fallback where user_profiles.id is already auth.users.id.
drop function if exists public.find_user_profile_for_association(text, text);

create function public.find_user_profile_for_association(
  target_association_id text,
  target_email text
)
returns table (
  id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  updated_at timestamptz
) as $$
  select
    coalesce(p.user_id, p.id) as id,
    p.display_name,
    p.email,
    p.created_at,
    p.updated_at
  from public.user_profiles p
  where exists (
      select 1
      from public.organization_members admin_membership
      where admin_membership.organization_id = target_association_id::uuid
        and admin_membership.user_id = public.current_profile_id()
        and admin_membership.role = 'admin'
    )
    and lower(p.email) = lower(btrim(target_email))
  limit 1;
$$ language sql stable security definer set search_path = public;

grant execute on function public.find_user_profile_for_association(text, text)
to authenticated;

notify pgrst, 'reload schema';
