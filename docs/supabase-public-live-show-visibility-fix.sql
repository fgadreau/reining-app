-- ShowScore public live show visibility hotfix.
--
-- A show can be public because one of its classes is actively published even
-- when the general schedule, draw, results, and livestream switches are off.
-- The shared helper already models that rule, but the row-level policies on
-- shows, show_days, and classes duplicated an older, narrower condition.
--
-- This migration changes visibility only. It does not update show, class,
-- setup, draw-order, scoring, or announcer-session data.

begin;

drop policy if exists "ShowScore public and HSP members can view shows"
  on public.shows;
create policy "ShowScore public and HSP members can view shows"
  on public.shows for select to authenticated, anon
  using (
    case
      when auth.uid() is null then
        public.showscore_public_show_exists(id)
      else
        public.is_platform_admin()
        or public.is_org_member(organization_id)
        or public.showscore_public_show_exists(id)
    end
  );

commit;
begin;

drop policy if exists "ShowScore public and HSP members can view show days"
  on public.show_days;
create policy "ShowScore public and HSP members can view show days"
  on public.show_days for select to authenticated, anon
  using (
    case
      when auth.uid() is null then
        public.showscore_public_show_exists(show_id)
      else
        public.is_platform_admin()
        or public.is_org_member(organization_id)
        or public.showscore_public_show_exists(show_id)
    end
  );

commit;
begin;

drop policy if exists "ShowScore public and HSP members can view classes"
  on public.classes;
create policy "ShowScore public and HSP members can view classes"
  on public.classes for select to authenticated, anon
  using (
    case
      when auth.uid() is null then
        is_public = true
        and public.showscore_public_show_exists(show_id)
      else
        public.is_platform_admin()
        or public.is_org_member(organization_id)
        or (
          is_public = true
          and public.showscore_public_show_exists(show_id)
        )
    end
  );

notify pgrst, 'reload schema';

commit;
