-- ShowScore/HSP platform-admin identity hotfix.
-- Applied to production through:
--   supabase/migrations/20260726141500_fix_platform_admin_identity.sql
--
-- This keeps the shared organizations RLS policy restrictive while allowing a
-- platform administrator whose auth/profile UUID linkage was recreated to be
-- recognized through the email claim signed by Supabase Auth.

begin;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = public.current_profile_id()
       or admin.user_id = auth.uid()
       or admin.id = public.current_profile_id()
       or admin.id = auth.uid()
       or (
         nullif(lower(btrim(admin.email)), '') is not null
         and lower(btrim(admin.email)) =
           lower(coalesce(auth.jwt() ->> 'email', ''))
       )
  );
$$;

comment on function public.is_platform_admin() is
  'Returns true for a platform administrator linked by profile UUID, auth UUID, or the verified email claim in the signed Supabase JWT.';

create or replace function public.showscore_update_organization_profile(
  target_organization_id uuid,
  target_name text,
  target_short_name text,
  target_timezone text,
  target_logo_url text,
  target_website_url text,
  target_sponsor_logos jsonb,
  target_is_test_mode boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_organization public.organizations;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '42501';
  end if;

  if not (
    public.is_platform_admin()
    or public.is_org_member(target_organization_id, array['admin']::text[])
  ) then
    raise exception 'Only platform or organization admins can update this organization'
      using errcode = '42501';
  end if;

  update public.organizations
  set
    name = coalesce(target_name, ''),
    short_name = coalesce(target_short_name, ''),
    timezone = coalesce(target_timezone, ''),
    logo_url = target_logo_url,
    website_url = target_website_url,
    sponsor_logos = coalesce(
      target_sponsor_logos,
      '{"version":2,"groups":[]}'::jsonb
    ),
    is_test_mode = coalesce(target_is_test_mode, false)
  where id = target_organization_id
  returning * into updated_organization;

  if updated_organization.id is null then
    raise exception 'Organization not found'
      using errcode = 'P0002';
  end if;

  return to_jsonb(updated_organization);
end;
$$;

revoke all on function public.showscore_update_organization_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean
) from public;

grant execute on function public.showscore_update_organization_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean
) to authenticated;

comment on function public.showscore_update_organization_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb,
  boolean
) is
  'Updates the ShowScore-managed public organization profile after an explicit platform-admin or organization-admin check.';

commit;
