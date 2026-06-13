-- Reining App V2 custom patterns migration
-- Run this once in Supabase SQL editor for existing projects.
-- Custom patterns support Trail / Obstacle Western now, and leave room for
-- Showmanship, Horsemanship, Hunt Seat Equitation, and other custom classes.

alter table public.classes
add column if not exists custom_pattern jsonb;

alter table public.class_setups
add column if not exists custom_pattern jsonb;

alter table public.official_results
add column if not exists custom_pattern jsonb;
