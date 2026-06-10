-- Reining App V2 planned live status migration
-- Run this once in Supabase SQL editor for existing projects.
-- Stores the live mode to apply when a class becomes current in the schedule.
-- The current public status remains hidden until the schedule activates it.

alter table public.publication_states
add column if not exists planned_live_status text not null default 'live_scoring';
