-- ShowScore association deletion for the shared HSP Supabase schema.
--
-- The frontend deletes associations through the canonical HSP table
-- public.organizations. HSP intentionally has no direct DELETE policy on that
-- table, so expose a narrow RPC that checks the caller server-side before
-- letting the FK cascades remove the organization and its dependent records.

begin;

create or replace function public.delete_association_as_admin(
  target_association_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
begin
  if nullif(btrim(coalesce(target_association_id, '')), '') is null then
    raise exception 'Association id is required'
      using errcode = '22023';
  end if;

  begin
    target_organization_id := target_association_id::uuid;
  exception
    when invalid_text_representation then
      raise exception 'Association id must be a UUID'
        using errcode = '22P02';
  end;

  if not exists (
    select 1
    from public.organizations organization
    where organization.id = target_organization_id
  ) then
    raise exception 'Association not found'
      using errcode = 'P0002';
  end if;

  if not (
    public.is_platform_admin()
    or public.is_org_member(target_organization_id, array['admin'])
  ) then
    raise exception 'Only association admins can delete this association'
      using errcode = '42501';
  end if;

  delete from public.organizations
  where id = target_organization_id;
end;
$$;

revoke all on function public.delete_association_as_admin(text) from public;
grant execute on function public.delete_association_as_admin(text)
to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
