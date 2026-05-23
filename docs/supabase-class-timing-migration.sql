-- Reining App V2 class timing migration
-- Run this once in Supabase SQL editor for existing projects.

alter table public.class_setups
add column if not exists started_at timestamptz;

alter table public.class_setups
add column if not exists drag_interval integer;

alter table public.class_setups
add column if not exists drag_duration_minutes integer not null default 8;
