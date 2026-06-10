-- Reining App V2 paid warmup arena migration
-- Run this once in Supabase SQL editor for existing projects.
-- Lets paid warm ups participate in the same per-arena live schedule as classes.

alter table public.paid_warmups
add column if not exists arena text;
