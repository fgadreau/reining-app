-- ShowScore shared-schema realtime migration
-- Run once in the Supabase SQL editor for the shared HSP/ShowScore project.
-- It makes the public live, OBS overlay, and announcer dashboard receive
-- websocket updates from the tables ShowScore currently reads.

do $$
declare
  realtime_table text;
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise notice 'Publication supabase_realtime not found. Enable Realtime in Supabase, then run this migration again.';
    return;
  end if;

  foreach realtime_table in array array[
    'shows',
    'show_days',
    'classes',
    'class_result_publications',
    'show_score_class_setups',
    'show_score_scoring_sessions',
    'show_score_judge_sessions',
    'show_score_official_results',
    'show_score_publication_states',
    'show_score_paid_warmups'
  ] loop
    if to_regclass('public.' || quote_ident(realtime_table)) is null then
      raise notice 'Skipping missing realtime table: %', realtime_table;
      continue;
    end if;

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
end $$;
