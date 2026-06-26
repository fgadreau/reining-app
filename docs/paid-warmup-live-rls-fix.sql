-- Paid warmup live RLS fix for the shared HSP/ShowScore schema.
-- Allows ShowScore staff to write the shared paid warmup rows used by
-- the public showcase. Without these policies, the announcer can keep
-- moving locally while the public view stays on a stale Supabase row.

drop policy if exists "ShowScore managers can insert paid warmups"
  on public.show_score_paid_warmups;
create policy "ShowScore managers can insert paid warmups"
  on public.show_score_paid_warmups for insert to authenticated
  with check (
    public.is_platform_admin()
    or exists (
      select 1
      from public.association_memberships membership
      where membership.association_id::text = show_score_paid_warmups.organization_id::text
        and membership.user_id = auth.uid()
        and membership.role in ('admin', 'secretary')
    )
  );

drop policy if exists "ShowScore announcers can update paid warmups"
  on public.show_score_paid_warmups;
create policy "ShowScore announcers can update paid warmups"
  on public.show_score_paid_warmups for update to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.association_memberships membership
      where membership.association_id::text = show_score_paid_warmups.organization_id::text
        and membership.user_id = auth.uid()
        and membership.role in ('admin', 'secretary', 'announcer')
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1
      from public.association_memberships membership
      where membership.association_id::text = show_score_paid_warmups.organization_id::text
        and membership.user_id = auth.uid()
        and membership.role in ('admin', 'secretary', 'announcer')
    )
  );

drop policy if exists "ShowScore managers can delete paid warmups"
  on public.show_score_paid_warmups;
create policy "ShowScore managers can delete paid warmups"
  on public.show_score_paid_warmups for delete to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1
      from public.association_memberships membership
      where membership.association_id::text = show_score_paid_warmups.organization_id::text
        and membership.user_id = auth.uid()
        and membership.role in ('admin', 'secretary')
    )
  );

notify pgrst, 'reload schema';
