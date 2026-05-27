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

create or replace function public.global_pattern_timing_stats(
  min_duration_seconds integer default 60
)
returns table (
  pattern text,
  class_count bigint,
  run_count bigint,
  timed_run_count bigint,
  average_run_seconds numeric,
  median_run_seconds numeric
) as $$
  with run_durations as (
    select
      coalesce(
        nullif(btrim(setup.pattern), ''),
        nullif(btrim(classes.pattern), ''),
        'Sans pattern'
      ) as pattern,
      classes.id as class_id,
      case
        when run.value ? 'durationSeconds'
          and nullif(run.value->>'durationSeconds', '') ~ '^[0-9]+(\.[0-9]+)?$'
          then (run.value->>'durationSeconds')::numeric
        when run.value ? 'startedAt'
          and run.value ? 'completedAt'
          and nullif(run.value->>'startedAt', '') is not null
          and nullif(run.value->>'completedAt', '') is not null
          then extract(
            epoch from (
              (run.value->>'completedAt')::timestamptz
              - (run.value->>'startedAt')::timestamptz
            )
          )
        else null
      end as duration_seconds
    from public.classes
    left join public.class_setups setup on setup.class_id = classes.id
    join public.scoring_sessions scoring on scoring.class_id = classes.id
    cross join lateral jsonb_array_elements(scoring.runs) as run(value)
  )
  select
    run_durations.pattern,
    count(distinct run_durations.class_id) as class_count,
    count(*) as run_count,
    count(*) filter (
      where run_durations.duration_seconds >= greatest(min_duration_seconds, 0)
        and run_durations.duration_seconds <= 540
    ) as timed_run_count,
    avg(run_durations.duration_seconds) filter (
      where run_durations.duration_seconds >= greatest(min_duration_seconds, 0)
        and run_durations.duration_seconds <= 540
    ) as average_run_seconds,
    percentile_cont(0.5) within group (
      order by run_durations.duration_seconds
    ) filter (
      where run_durations.duration_seconds >= greatest(min_duration_seconds, 0)
        and run_durations.duration_seconds <= 540
    ) as median_run_seconds
  from run_durations
  group by run_durations.pattern
  having count(*) filter (
    where run_durations.duration_seconds >= greatest(min_duration_seconds, 0)
      and run_durations.duration_seconds <= 540
  ) > 0
  order by run_durations.pattern;
$$ language sql stable security definer set search_path = public;

grant execute on function public.global_pattern_timing_stats(integer)
to authenticated;
