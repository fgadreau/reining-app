-- Reining App V2 announcer realtime migration
-- Run this once in Supabase SQL editor for existing projects.
-- This enables websocket updates for the announcer dashboard when scoring,
-- publication, setup, show, day, or class data changes.

do $$
declare
  realtime_table text;
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    foreach realtime_table in array array[
      'shows',
      'days',
      'classes',
      'class_setups',
      'scoring_sessions',
      'official_results',
      'publication_states'
    ] loop
      if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = realtime_table
      ) then
        execute format(
          'alter publication supabase_realtime add table public.%I',
          realtime_table
        );
      end if;
    end loop;
  else
    raise notice 'Publication supabase_realtime not found. Enable Realtime in Supabase, then run this migration again.';
  end if;
end $$;
