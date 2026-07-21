-- ShowScore public TV show context.
--
-- The regular shows SELECT policy intentionally hides non-public show rows.
-- The arena TV page still needs a small, safe subset of an active show's
-- metadata while it is idle and no class is currently public/live.

create or replace function public.get_public_tv_show_context(
  target_show_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(show_context)
  from (
    select
      shows.id,
      shows.organization_id,
      shows.name,
      shows.venue,
      shows.location,
      shows.start_date,
      shows.end_date,
      shows.status,
      shows.tv_display_paused,
      shows.tv_display_message_fr,
      shows.tv_display_message_en
    from public.shows
    where shows.id = target_show_id
      and shows.status = 'open'
  ) as show_context;
$$;

revoke all on function public.get_public_tv_show_context(uuid) from public;
grant execute on function public.get_public_tv_show_context(uuid)
  to anon, authenticated;
