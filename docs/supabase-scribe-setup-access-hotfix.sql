-- Production ShowScore hotfix.
-- Keep association-level scribes able to read a prepared setup before scoring
-- starts. This mirrors their existing can_score_show_score_class permission.
--
-- The canonical HSP migration must preserve this role when its pending schema
-- rebuild is eventually deployed.

create or replace function public.can_view_show_score_show(
  target_show_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shows s
    where s.id = target_show_id
      and (
        public.is_platform_admin()
        or public.is_org_member(
          s.organization_id,
          array['admin', 'secretary', 'scribe']
        )
        or public.has_show_role(
          s.id,
          array['organizer', 'secretary', 'judge', 'scribe', 'announcer']
        )
      )
  )
$$;

notify pgrst, 'reload schema';
