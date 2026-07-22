-- ShowScore public TV show context.
--
-- The regular shows SELECT policy intentionally hides non-public show rows.
-- The arena TV page still needs a small, safe subset of a draft or active
-- show's metadata while it is idle and no class is currently public/live.
--
-- TV links contain the show's UUID and are deliberately usable before the
-- show is opened publicly.  Return an "open" compatibility status for that
-- TV-only context so the current public client accepts draft shows without
-- changing the real status stored in public.shows.

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
      case
        when shows.status = 'draft' then 'open'
        else shows.status
      end as status,
      shows.tv_display_paused,
      shows.tv_display_message_fr,
      shows.tv_display_message_en,
      shows.tv_display_video_path,
      shows.tv_display_video_name,
      shows.tv_display_video_size,
      shows.tv_display_video_arena,
      shows.livestream_urls_by_date
    from public.shows
    where shows.id = target_show_id
      and shows.status in ('draft', 'open')
  ) as show_context;
$$;

revoke all on function public.get_public_tv_show_context(uuid) from public;
grant execute on function public.get_public_tv_show_context(uuid)
  to anon, authenticated;
