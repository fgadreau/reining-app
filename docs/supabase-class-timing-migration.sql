-- Reining App V2 class timing migration
-- Run this once in Supabase SQL editor for existing projects.
-- started_at is the real scoring start, captured when the scribe enters the
-- first score or penalty. It is not a planned class start time.

alter table public.class_setups
add column if not exists started_at timestamptz;

alter table public.class_setups
add column if not exists drag_interval integer;

alter table public.class_setups
add column if not exists drag_duration_minutes integer not null default 8;
