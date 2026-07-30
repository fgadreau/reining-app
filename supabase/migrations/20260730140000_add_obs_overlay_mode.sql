alter table public.shows
  add column if not exists obs_overlay_mode text not null default 'live'
  check (obs_overlay_mode in ('live', 'neutral'));
