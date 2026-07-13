-- Fix: adding an access role to an EXISTING account fails with
-- "42P10 there is no unique or exclusion constraint matching the ON
-- CONFLICT specification" from both the platform admin page and the
-- association admin page.
--
-- Cause: since the migration to the shared HSP schema,
-- association_memberships is a VIEW over organization_members, whose
-- real unique constraint is (organization_id, user_id) — not
-- (user_id, association_id, role) as the ShowScore front-end upsert
-- assumes. The invitation-acceptance flow already works around this
-- via a dedicated RPC (accept_association_invitation); this adds the
-- equivalent RPC for direct admin-initiated grants.
--
-- Run this in Supabase before deploying the matching JS change.

drop function if exists public.grant_association_membership(uuid, text, text);

create function public.grant_association_membership(
  target_user_id uuid,
  target_association_id text,
  target_role text
)
returns table (
  id uuid,
  user_id uuid,
  association_id uuid,
  role text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile_id uuid;
  v_is_platform_admin boolean;
  v_is_association_admin boolean;
  v_membership_id uuid;
begin
  select public.current_user_is_platform_admin() into v_is_platform_admin;

  select exists (
    select 1
    from public.association_memberships m
    where m.association_id::text = target_association_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  ) into v_is_association_admin;

  if not (v_is_platform_admin or v_is_association_admin) then
    raise exception 'Accès refusé.';
  end if;

  select p.id into v_profile_id
  from public.user_profiles p
  where coalesce(p.user_id, p.id) = target_user_id;

  if v_profile_id is null then
    raise exception 'Utilisateur introuvable.';
  end if;

  insert into public.organization_members (user_id, organization_id, role)
  values (v_profile_id, target_association_id::uuid, target_role)
  on conflict (organization_id, user_id) do update set role = excluded.role
  returning organization_members.id into v_membership_id;

  return query
  select m.id, target_user_id, m.association_id, m.role, m.created_at, m.updated_at
  from public.association_memberships m
  where m.id = v_membership_id;
end;
$function$;

grant execute on function public.grant_association_membership(uuid, text, text)
to authenticated;

notify pgrst, 'reload schema';
