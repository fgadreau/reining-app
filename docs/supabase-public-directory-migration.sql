-- Reining App V2 public directory migration
-- Run this once in Supabase SQL editor for existing projects.
-- This allows anonymous visitors to browse associations, shows, days, live
-- classes, and published official results.

create or replace function public.class_is_publicly_visible(
  target_class_id text
)
returns boolean as $$
  select public.class_has_published_official_result(target_class_id)
    or exists (
      select 1
      from public.publication_states ps
      where ps.class_id = target_class_id
        and ps.status = 'live'
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.show_has_public_class(
  target_show_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.show_id = target_show_id
      and public.class_is_publicly_visible(c.id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.day_has_public_class(
  target_day_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.day_id = target_day_id
      and public.class_is_publicly_visible(c.id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.association_has_public_class(
  target_association_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.association_id = target_association_id
      and public.class_is_publicly_visible(c.id)
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "Anyone can read associations with public classes" on public.associations;
create policy "Anyone can read associations with public classes"
on public.associations for select to anon, authenticated
using (public.association_has_public_class(id));

drop policy if exists "Anyone can read shows with published official results" on public.shows;
drop policy if exists "Anyone can read shows with public classes" on public.shows;
create policy "Anyone can read shows with public classes"
on public.shows for select to anon, authenticated
using (public.show_has_public_class(id));

drop policy if exists "Anyone can read days with published official results" on public.days;
drop policy if exists "Anyone can read days with public classes" on public.days;
create policy "Anyone can read days with public classes"
on public.days for select to anon, authenticated
using (public.day_has_public_class(id));

drop policy if exists "Anyone can read published classes" on public.classes;
drop policy if exists "Anyone can read public classes" on public.classes;
create policy "Anyone can read public classes"
on public.classes for select to anon, authenticated
using (public.class_is_publicly_visible(id));

drop policy if exists "Anyone can read published publication states" on public.publication_states;
drop policy if exists "Anyone can read public publication states" on public.publication_states;
create policy "Anyone can read public publication states"
on public.publication_states for select to anon, authenticated
using (
  status = 'live'
  or (
    status = 'published'
    and public.class_has_published_official_result(class_id)
  )
);

drop policy if exists "Anyone can read published official results" on public.official_results;
create policy "Anyone can read published official results"
on public.official_results for select to anon, authenticated
using (
  finalized is true
  and secretariat_validated_at is not null
  and exists (
    select 1
    from public.publication_states ps
    where ps.class_id = official_results.class_id
      and ps.status = 'published'
  )
);

drop policy if exists "Anyone can read live scoring sessions" on public.scoring_sessions;
create policy "Anyone can read live scoring sessions"
on public.scoring_sessions for select to anon, authenticated
using (
  exists (
    select 1
    from public.publication_states ps
    where ps.class_id = scoring_sessions.class_id
      and ps.status = 'live'
  )
);

drop function if exists public.public_show_timing_summary(text, integer);

create or replace function public.public_show_timing_summary(
  target_show_id text,
  min_duration_seconds integer default 150
)
returns table (
  class_id text,
  day_id text,
  class_estimated_end_at timestamptz,
  day_estimated_end_at timestamptz,
  class_remaining_seconds numeric,
  day_remaining_seconds numeric,
  class_remaining_runs integer,
  day_remaining_runs integer,
  is_drag_due boolean,
  drag_started_at timestamptz,
  drag_duration_minutes integer,
  drag_remaining_seconds numeric,
  estimated_at timestamptz
) as $$
  with run_durations as (
    select
      coalesce(
        nullif(btrim(setup.pattern), ''),
        nullif(btrim(classes.pattern), ''),
        'Sans pattern'
      ) as pattern,
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
    cross join lateral jsonb_array_elements(
      coalesce(scoring.runs, '[]'::jsonb)
    ) as run(value)
  ),
  pattern_averages as (
    select
      pattern,
      avg(duration_seconds) filter (
        where duration_seconds >= greatest(min_duration_seconds, 0)
      ) as average_run_seconds
    from run_durations
    group by pattern
  ),
  class_metrics as (
    select
      classes.id,
      classes.day_id,
      classes.sort_order,
      coalesce(
        nullif(btrim(setup.pattern), ''),
        nullif(btrim(classes.pattern), ''),
        'Sans pattern'
      ) as pattern,
      case
        when setup.drag_interval is not null and setup.drag_interval > 0
          then setup.drag_interval
        else null
      end as drag_interval,
      greatest(coalesce(setup.drag_duration_minutes, 8), 0) as drag_duration_minutes,
      greatest(
        jsonb_array_length(coalesce(scoring.runs, '[]'::jsonb)),
        jsonb_array_length(coalesce(setup.runs, '[]'::jsonb))
      ) as run_count,
      completed.completed_runs,
      completed.last_completed_at,
      class_average.average_run_seconds as class_average_run_seconds,
      pattern_averages.average_run_seconds as pattern_average_run_seconds,
      (
        scoring.active_manoeuvre is not null
        or exists (
          select 1
          from jsonb_array_elements(coalesce(scoring.runs, '[]'::jsonb)) as active_run(value)
          where active_run.value->>'isActive' = 'true'
        )
      ) as has_active_manoeuvre
    from public.classes
    left join public.class_setups setup on setup.class_id = classes.id
    left join public.scoring_sessions scoring on scoring.class_id = classes.id
    left join pattern_averages on pattern_averages.pattern = coalesce(
      nullif(btrim(setup.pattern), ''),
      nullif(btrim(classes.pattern), ''),
      'Sans pattern'
    )
    cross join lateral (
      select
        count(*)::integer as completed_runs,
        max(
          case
            when nullif(run.value->>'completedAt', '') is not null
              then (run.value->>'completedAt')::timestamptz
            else null
          end
        ) as last_completed_at
      from jsonb_array_elements(coalesce(scoring.runs, '[]'::jsonb)) as run(value)
      where nullif(btrim(run.value->>'scoreTotal'), '') is not null
        and btrim(run.value->>'scoreTotal') <> 'Review'
    ) completed
    cross join lateral (
      select avg(duration_seconds) filter (
        where duration_seconds >= greatest(min_duration_seconds, 0)
      ) as average_run_seconds
      from (
        select
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
        from jsonb_array_elements(coalesce(scoring.runs, '[]'::jsonb)) as run(value)
      ) durations
    ) class_average
    where classes.show_id = target_show_id
  ),
  class_estimates as (
    select
      class_metrics.*,
      coalesce(
        class_metrics.class_average_run_seconds,
        class_metrics.pattern_average_run_seconds
      ) as average_run_seconds,
      greatest(class_metrics.run_count - class_metrics.completed_runs, 0) as remaining_runs,
      case
        when class_metrics.drag_interval is null then 0
        else greatest(
          floor(greatest(class_metrics.run_count - 1, 0)::numeric / class_metrics.drag_interval)
          - floor(greatest(class_metrics.completed_runs - 1, 0)::numeric / class_metrics.drag_interval),
          0
        )::integer
      end as remaining_drag_breaks
    from class_metrics
  ),
  class_remaining as (
    select
      class_estimates.*,
      case
        when class_estimates.remaining_runs > 0
          and class_estimates.average_run_seconds is null
          then null
        else
          class_estimates.remaining_runs * coalesce(class_estimates.average_run_seconds, 0)
          + class_estimates.remaining_drag_breaks
            * class_estimates.drag_duration_minutes
            * 60
      end as remaining_seconds
    from class_estimates
  ),
  live_classes as (
    select
      class_remaining.*,
      row_number() over (
        order by
          class_remaining.has_active_manoeuvre desc,
          class_remaining.sort_order,
          class_remaining.id
      ) as live_rank
    from class_remaining
    join public.publication_states publication
      on publication.class_id = class_remaining.id
     and publication.status = 'live'
  ),
  day_remaining as (
    select
      live_classes.id as live_class_id,
      sum(class_remaining.remaining_runs)::integer as day_remaining_runs,
      case
        when bool_or(
          class_remaining.remaining_runs > 0
          and class_remaining.remaining_seconds is null
        ) then null
        else sum(coalesce(class_remaining.remaining_seconds, 0))
      end as day_remaining_seconds
    from live_classes
    join class_remaining
      on class_remaining.day_id = live_classes.day_id
     and class_remaining.sort_order >= live_classes.sort_order
    group by live_classes.id
  )
  select
    live_classes.id as class_id,
    live_classes.day_id,
    case
      when live_classes.remaining_seconds is null then null
      else now() + make_interval(secs => live_classes.remaining_seconds::double precision)
    end as class_estimated_end_at,
    case
      when day_remaining.day_remaining_seconds is null then null
      else now() + make_interval(secs => day_remaining.day_remaining_seconds::double precision)
    end as day_estimated_end_at,
    live_classes.remaining_seconds as class_remaining_seconds,
    day_remaining.day_remaining_seconds,
    live_classes.remaining_runs as class_remaining_runs,
    day_remaining.day_remaining_runs,
    (
      live_classes.drag_interval is not null
      and live_classes.completed_runs > 0
      and live_classes.completed_runs < live_classes.run_count
      and live_classes.completed_runs % live_classes.drag_interval = 0
      and live_classes.has_active_manoeuvre is false
    ) as is_drag_due,
    case
      when live_classes.drag_interval is not null
        and live_classes.completed_runs > 0
        and live_classes.completed_runs < live_classes.run_count
        and live_classes.completed_runs % live_classes.drag_interval = 0
        and live_classes.has_active_manoeuvre is false
        then live_classes.last_completed_at
      else null
    end as drag_started_at,
    live_classes.drag_duration_minutes,
    case
      when live_classes.drag_interval is not null
        and live_classes.completed_runs > 0
        and live_classes.completed_runs < live_classes.run_count
        and live_classes.completed_runs % live_classes.drag_interval = 0
        and live_classes.has_active_manoeuvre is false
        and live_classes.last_completed_at is not null
        then greatest(
          live_classes.drag_duration_minutes * 60
          - extract(epoch from (now() - live_classes.last_completed_at)),
          0
        )
      else null
    end as drag_remaining_seconds,
    now() as estimated_at
  from live_classes
  join day_remaining on day_remaining.live_class_id = live_classes.id
  order by live_classes.live_rank;
$$ language sql stable security definer set search_path = public;

grant execute on function public.public_show_timing_summary(text, integer)
to anon, authenticated;
