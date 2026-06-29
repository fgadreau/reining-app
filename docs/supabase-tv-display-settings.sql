-- ShowScore TV display settings.
-- Run in Supabase before relying on the arena TV pause/message controls in production.

alter table public.shows
  add column if not exists tv_display_paused boolean not null default false,
  add column if not exists tv_display_message_fr text,
  add column if not exists tv_display_message_en text;
