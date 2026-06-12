-- Shared ShowScore + HorseShowPlatform Supabase compatibility layer.
--
-- Use this only on the shared Supabase project that serves both
-- showscore.app and horseshowplatform.app.
--
-- Run HorseShowPlatform migrations first. Then run this file.
-- Do not run docs/supabase-schema.sql on the shared HSP project; that file is
-- the standalone ShowScore schema.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Compatibility columns expected by ShowScore.
-- HSP remains the owner of the canonical base model:
-- organizations, shows, show_days, classes.
-- ---------------------------------------------------------------------------

alter table public.shows
  add column if not exists livestream_url text,
  add column if not exists is_livestream_public boolean not null default false,
  add column if not exists user_id uuid;

alter table public.show_days
  add column if not exists user_id uuid;

alter table public.classes
  add column if not exists arena varchar(100),
  add column if not exists pattern text,
  add column if not exists custom_pattern jsonb,
  add column if not exists judge_name varchar(255),
  add column if not exists sort_order integer not null default 1,
  add column if not exists schedule_start_mode text not null default 'unscheduled',
  add column if not exists scheduled_time time,
  add column if not exists user_id uuid;

alter table public.organizations
  add column if not exists short_name varchar(100),
  add column if not exists sponsor_logos jsonb not null default '[]'::jsonb;

alter table public.user_profiles
  add column if not exists user_id uuid,
  add column if not exists email text,
  add column if not exists display_name text,
  add column if not exists first_name varchar(100),
  add column if not exists last_name varchar(100),
  add column if not exists phone varchar(20),
  add column if not exists type_user varchar(50),
  add column if not exists address varchar(255),
  add column if not exists city varchar(100),
  add column if not exists state varchar(50),
  add column if not exists zip_code varchar(20),
  add column if not exists country varchar(2),
  add column if not exists avatar_url text,
  add column if not exists date_of_birth date,
  add column if not exists address_line2 varchar(255),
  add column if not exists preferred_locale varchar(5) not null default 'fr',
  add column if not exists marketing_opt_in boolean not null default false;

alter table public.platform_admins
  add column if not exists user_id uuid,
  add column if not exists email text,
  add column if not exists permissions jsonb not null default '[]'::jsonb;

-- Make pre-existing standalone ShowScore profiles usable by HSP functions.
update public.user_profiles profile
set user_id = profile.id
where profile.user_id is null
  and exists (
    select 1
    from auth.users auth_user
    where auth_user.id = profile.id
  );

update public.user_profiles profile
set
  email = coalesce(nullif(profile.email, ''), auth_user.email),
  display_name = coalesce(
    nullif(profile.display_name, ''),
    nullif(btrim(concat_ws(' ', profile.first_name, profile.last_name)), ''),
    split_part(auth_user.email, '@', 1)
  ),
  first_name = coalesce(
    nullif(profile.first_name, ''),
    initcap(split_part(replace(split_part(auth_user.email, '@', 1), '_', '.'), '.', 1))
  ),
  last_name = coalesce(nullif(profile.last_name, ''), ''),
  type_user = coalesce(nullif(profile.type_user, ''), 'owner'),
  country = coalesce(nullif(profile.country, ''), 'CA')
from auth.users auth_user
where auth_user.id = coalesce(profile.user_id, profile.id);

update public.platform_admins admin
set user_id = profile.id
from public.user_profiles profile
where admin.user_id is null
  and (
    profile.id = admin.id
    or profile.user_id = admin.id
    or (
      admin.email is not null
      and profile.email is not null
      and lower(profile.email) = lower(admin.email)
    )
  );

update public.platform_admins admin
set email = profile.email
from public.user_profiles profile
where admin.email is null
  and admin.user_id = profile.id
  and profile.email is not null;

create unique index if not exists user_profiles_user_id_unique_idx
on public.user_profiles (user_id);

create unique index if not exists platform_admins_user_id_unique_idx
on public.platform_admins (user_id);

create or replace function public.showscore_hsp_user_profile_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  auth_email text;
  profile_key uuid;
begin
  if new.id is null and new.user_id is not null then
    new.id := new.user_id;
  end if;

  if new.user_id is null
    and new.id is not null
    and exists (select 1 from auth.users auth_user where auth_user.id = new.id)
  then
    new.user_id := new.id;
  end if;

  profile_key := coalesce(new.user_id, new.id);

  if profile_key is not null then
    select auth_user.email
      into auth_email
    from auth.users auth_user
    where auth_user.id = profile_key;
  end if;

  if nullif(btrim(coalesce(new.email, '')), '') is null
    and auth_email is not null
  then
    new.email := lower(auth_email);
  end if;

  if nullif(btrim(coalesce(new.display_name, '')), '') is null then
    new.display_name := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');

    if new.display_name is null and new.email is not null then
      new.display_name := split_part(new.email, '@', 1);
    end if;
  end if;

  if nullif(btrim(coalesce(new.first_name, '')), '') is null
    and new.email is not null
  then
    new.first_name := initcap(split_part(replace(split_part(new.email, '@', 1), '_', '.'), '.', 1));
  end if;

  if new.last_name is null then
    new.last_name := '';
  end if;

  if new.type_user is null then
    new.type_user := 'owner';
  end if;

  if new.country is null then
    new.country := 'CA';
  end if;

  return new;
end;
$$;

drop trigger if exists showscore_hsp_user_profile_defaults on public.user_profiles;
create trigger showscore_hsp_user_profile_defaults
  before insert or update on public.user_profiles
  for each row execute function public.showscore_hsp_user_profile_defaults();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (
    id,
    user_id,
    email,
    first_name,
    last_name,
    display_name
  )
  values (
    new.id,
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      ''
    )
  )
  on conflict (user_id) do update
    set
      email = coalesce(public.user_profiles.email, excluded.email),
      display_name = coalesce(
        nullif(public.user_profiles.display_name, ''),
        excluded.display_name
      ),
      first_name = coalesce(
        nullif(public.user_profiles.first_name, ''),
        excluded.first_name
      ),
      last_name = coalesce(
        nullif(public.user_profiles.last_name, ''),
        excluded.last_name
      ),
      updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.show_score_class_setups
  add column if not exists block_classes jsonb not null default '[]'::jsonb,
  add column if not exists judge_name text,
  add column if not exists judge_signature text,
  add column if not exists judge_signed_at timestamptz,
  add column if not exists user_id uuid;

alter table public.show_score_judge_sessions
  add column if not exists claimed_by text;

alter table public.show_score_publication_states
  add column if not exists planned_live_status text not null default 'live_scoring',
  add column if not exists published_by text;

alter table public.show_score_paid_warmups
  add column if not exists arena text,
  add column if not exists schedule_start_mode text,
  add column if not exists schedule_start_time text;

-- Keep HSP and ShowScore status values in the same table.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.show_score_publication_states'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format(
      'alter table public.show_score_publication_states drop constraint if exists %I',
      constraint_name
    );
  end loop;
end $$;

alter table public.show_score_publication_states
  add constraint show_score_publication_states_status_check
  check (
    status in (
      'hidden',
      'live',
      'live_no_score',
      'live_scoring',
      'live_finished',
      'pending_review',
      'official',
      'published'
    )
  );

-- HSP identifies access through the profile row id; standalone ShowScore used
-- auth.users.id directly. Keep both shapes readable after the merge.
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profile.id
  from public.user_profiles profile
  where profile.user_id = auth.uid()
     or profile.id = auth.uid()
  order by case when profile.user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins admin
    where admin.user_id = public.current_profile_id()
       or admin.user_id = auth.uid()
       or admin.id = auth.uid()
  );
$$;

-- Alias expected by ShowScore's admin checks.
create or replace function public.current_user_is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin();
$$;

-- Shared active-public gate. HSP's ShowScore equivalent for active is open.
create or replace function public.showscore_public_show_exists(target_show_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shows s
    where s.id = target_show_id
      and s.status = 'open'
      and (
        s.is_public = true
        or s.show_schedule_public = true
        or s.show_draw_public = true
        or s.show_results_public = true
        or s.is_livestream_public = true
      )
  );
$$;

create or replace function public.showscore_public_class_exists(target_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes c
    join public.shows s on s.id = c.show_id
    where c.id = target_class_id
      and c.is_public = true
      and s.status = 'open'
      and (
        s.is_public = true
        or s.show_schedule_public = true
        or s.show_draw_public = true
        or s.show_results_public = true
        or s.is_livestream_public = true
      )
  );
$$;

-- HSP exposes ShowScore-compatible views. Mark them as security invoker so
-- anonymous reads still go through the base-table RLS policies below.
create or replace view public.associations
with (security_invoker = true)
as
select
  id,
  name,
  short_name,
  timezone,
  logo_url as logo_data_url,
  website_url,
  sponsor_logos,
  created_at,
  updated_at
from public.organizations;

create or replace view public.days
with (security_invoker = true)
as
select
  id,
  organization_id as association_id,
  show_id,
  day_name as label,
  day_date as date,
  sort_order,
  created_at,
  updated_at
from public.show_days;

-- ---------------------------------------------------------------------------
-- Public RLS policies.
-- Authenticated HSP members keep their normal access. Anonymous public access
-- is constrained to open, public shows.
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.shows enable row level security;
alter table public.show_days enable row level security;
alter table public.classes enable row level security;
alter table public.show_score_class_setups enable row level security;
alter table public.show_score_scoring_sessions enable row level security;
alter table public.show_score_judge_sessions enable row level security;
alter table public.show_score_official_results enable row level security;
alter table public.show_score_publication_states enable row level security;
alter table public.show_score_paid_warmups enable row level security;
alter table public.class_result_publications enable row level security;

drop policy if exists "Anyone can view organizations" on public.organizations;
create policy "Anyone can view organizations"
  on public.organizations for select
  using (true);

drop policy if exists "Show organizers manage show days" on public.show_days;
create policy "Show organizers manage show days"
  on public.show_days for all to authenticated
  using (public.can_manage_show(show_id, array['organizer']))
  with check (public.can_manage_show(show_id, array['organizer']));

drop policy if exists "Show organizers manage classes" on public.classes;
create policy "Show organizers manage classes"
  on public.classes for all to authenticated
  using (public.can_manage_show(show_id, array['organizer']))
  with check (public.can_manage_show(show_id, array['organizer']));

drop policy if exists "Linked contacts can view show days" on public.show_days;
create policy "Linked contacts can view show days"
  on public.show_days for select to authenticated
  using (public.has_linked_contact_in_org(organization_id));

drop policy if exists "Public and members can view shows" on public.shows;
drop policy if exists "Anyone can view public shows" on public.shows;
drop policy if exists "Anyone can read shows with published official results" on public.shows;
drop policy if exists "Anyone can read shows with public classes" on public.shows;
drop policy if exists "ShowScore public and HSP members can view shows" on public.shows;
create policy "ShowScore public and HSP members can view shows"
  on public.shows for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        status = 'open'
        and (
          is_public = true
          or show_schedule_public = true
          or show_draw_public = true
          or show_results_public = true
          or is_livestream_public = true
        )
      else
        public.is_platform_admin()
        or public.is_org_member(organization_id)
        or (
          status = 'open'
          and (
            is_public = true
            or show_schedule_public = true
            or show_draw_public = true
            or show_results_public = true
            or is_livestream_public = true
          )
        )
    end
  );

drop policy if exists "Public and members can view show days" on public.show_days;
drop policy if exists "Anyone can view days of public shows" on public.show_days;
drop policy if exists "Anyone can read days with published official results" on public.show_days;
drop policy if exists "Anyone can read days with public classes" on public.show_days;
drop policy if exists "ShowScore public and HSP members can view show days" on public.show_days;
create policy "ShowScore public and HSP members can view show days"
  on public.show_days for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        exists (
          select 1
          from public.shows s
          where s.id = show_days.show_id
            and s.status = 'open'
            and (
              s.is_public = true
              or s.show_schedule_public = true
              or s.show_draw_public = true
              or s.show_results_public = true
              or s.is_livestream_public = true
            )
        )
      else
        public.is_platform_admin()
        or public.is_org_member(organization_id)
        or exists (
          select 1
          from public.shows s
          where s.id = show_days.show_id
            and s.status = 'open'
            and (
              s.is_public = true
              or s.show_schedule_public = true
              or s.show_draw_public = true
              or s.show_results_public = true
              or s.is_livestream_public = true
            )
        )
    end
  );

drop policy if exists "Public and members can view classes" on public.classes;
drop policy if exists "Anyone can view classes of public shows" on public.classes;
drop policy if exists "Anyone can read published classes" on public.classes;
drop policy if exists "Anyone can read public classes" on public.classes;
drop policy if exists "ShowScore public and HSP members can view classes" on public.classes;
create policy "ShowScore public and HSP members can view classes"
  on public.classes for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        is_public = true
        and exists (
          select 1
          from public.shows s
          where s.id = classes.show_id
            and s.status = 'open'
            and (
              s.is_public = true
              or s.show_schedule_public = true
              or s.show_draw_public = true
              or s.show_results_public = true
              or s.is_livestream_public = true
            )
        )
      else
        public.is_platform_admin()
        or public.is_org_member(organization_id)
        or (
          is_public = true
          and exists (
            select 1
            from public.shows s
            where s.id = classes.show_id
              and s.status = 'open'
              and (
                s.is_public = true
                or s.show_schedule_public = true
                or s.show_draw_public = true
                or s.show_results_public = true
                or s.is_livestream_public = true
              )
          )
        )
    end
  );

drop policy if exists "Anyone can view class setups of public shows" on public.show_score_class_setups;
drop policy if exists "ShowScore public can view class setups" on public.show_score_class_setups;
create policy "ShowScore public can view class setups"
  on public.show_score_class_setups for select to anon, authenticated
  using (
    case
      when auth.uid() is null then public.showscore_public_class_exists(class_id)
      else public.can_view_show_score_class(class_id)
        or public.showscore_public_class_exists(class_id)
    end
  );

drop policy if exists "ShowScore staff and public can view publication states" on public.show_score_publication_states;
drop policy if exists "Anyone can view publication states of public shows" on public.show_score_publication_states;
drop policy if exists "Anyone can read published publication states" on public.show_score_publication_states;
drop policy if exists "Anyone can read public publication states" on public.show_score_publication_states;
drop policy if exists "ShowScore public can view publication states" on public.show_score_publication_states;
create policy "ShowScore public can view publication states"
  on public.show_score_publication_states for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        status in ('live', 'live_no_score', 'live_scoring', 'live_finished', 'official', 'published')
        and public.showscore_public_class_exists(class_id)
      else
        public.can_view_show_score_class(class_id)
        or (
          status in ('live', 'live_no_score', 'live_scoring', 'live_finished', 'official', 'published')
          and public.showscore_public_class_exists(class_id)
        )
    end
  );

drop policy if exists "ShowScore staff and public can view official results" on public.show_score_official_results;
drop policy if exists "Anyone can view official results of public shows" on public.show_score_official_results;
drop policy if exists "Anyone can read published official results" on public.show_score_official_results;
drop policy if exists "ShowScore public can view official results" on public.show_score_official_results;
create policy "ShowScore public can view official results"
  on public.show_score_official_results for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        finalized = true
        and secretariat_validated_at is not null
        and public.showscore_public_class_exists(class_id)
        and exists (
          select 1
          from public.show_score_publication_states ps
          where ps.class_id = show_score_official_results.class_id
            and ps.status in ('official', 'published')
        )
      else
        public.can_view_show_score_class(class_id)
        or (
          finalized = true
          and secretariat_validated_at is not null
          and public.showscore_public_class_exists(class_id)
          and exists (
            select 1
            from public.show_score_publication_states ps
            where ps.class_id = show_score_official_results.class_id
              and ps.status in ('official', 'published')
          )
        )
    end
  );

drop policy if exists "Anyone can read live scoring sessions" on public.show_score_scoring_sessions;
drop policy if exists "ShowScore public can view live scoring sessions" on public.show_score_scoring_sessions;
create policy "ShowScore public can view live scoring sessions"
  on public.show_score_scoring_sessions for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        public.showscore_public_class_exists(class_id)
        and exists (
          select 1
          from public.show_score_publication_states ps
          where ps.class_id = show_score_scoring_sessions.class_id
            and ps.status in ('live', 'live_no_score', 'live_scoring', 'live_finished')
        )
      else
        public.can_view_show_score_class(class_id)
        or (
          public.showscore_public_class_exists(class_id)
          and exists (
            select 1
            from public.show_score_publication_states ps
            where ps.class_id = show_score_scoring_sessions.class_id
              and ps.status in ('live', 'live_no_score', 'live_scoring', 'live_finished')
          )
        )
    end
  );

drop policy if exists "Anyone can read live judge scoring sessions" on public.show_score_judge_sessions;
drop policy if exists "ShowScore public can view live judge sessions" on public.show_score_judge_sessions;
create policy "ShowScore public can view live judge sessions"
  on public.show_score_judge_sessions for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        public.showscore_public_class_exists(class_id)
        and exists (
          select 1
          from public.show_score_publication_states ps
          where ps.class_id = show_score_judge_sessions.class_id
            and ps.status in ('live', 'live_no_score', 'live_scoring', 'live_finished')
        )
      else
        public.can_view_show_score_class(class_id)
        or (
          public.showscore_public_class_exists(class_id)
          and exists (
            select 1
            from public.show_score_publication_states ps
            where ps.class_id = show_score_judge_sessions.class_id
              and ps.status in ('live', 'live_no_score', 'live_scoring', 'live_finished')
          )
        )
    end
  );

drop policy if exists "ShowScore staff and public can view paid warmups" on public.show_score_paid_warmups;
drop policy if exists "Anyone can read live paid warmups" on public.show_score_paid_warmups;
drop policy if exists "Anyone can read public schedule paid warmups" on public.show_score_paid_warmups;
drop policy if exists "ShowScore public can view paid warmups" on public.show_score_paid_warmups;
create policy "ShowScore public can view paid warmups"
  on public.show_score_paid_warmups for select to anon, authenticated
  using (
    case
      when auth.uid() is null then
        public.showscore_public_show_exists(show_id)
        and (
          is_public_live = true
          or exists (
            select 1
            from public.shows s
            where s.id = show_score_paid_warmups.show_id
              and s.status = 'open'
              and (s.is_public = true or s.show_schedule_public = true)
          )
        )
      else
        public.can_view_show_score_show(show_id)
        or (
          public.showscore_public_show_exists(show_id)
          and (
            is_public_live = true
            or exists (
              select 1
              from public.shows s
              where s.id = show_score_paid_warmups.show_id
                and s.status = 'open'
                and (s.is_public = true or s.show_schedule_public = true)
            )
          )
        )
    end
  );

drop policy if exists "public can read published class_result_publications" on public.class_result_publications;
drop policy if exists "Anyone can read published class result publications" on public.class_result_publications;
drop policy if exists "ShowScore public can view published class results" on public.class_result_publications;
create policy "ShowScore public can view published class results"
  on public.class_result_publications for select to anon, authenticated
  using (
    status = 'published'
    and result_groups <> '[]'::jsonb
    and public.showscore_public_class_exists(class_id)
  );

-- ---------------------------------------------------------------------------
-- Public timing RPC adapted to HSP tables.
-- ---------------------------------------------------------------------------

drop function if exists public.public_show_timing_summary(text, integer);
drop function if exists public.public_show_timing_summary(uuid, integer);

create or replace function public.public_show_timing_summary(
  target_show_id uuid,
  min_duration_seconds integer default 60
)
returns table (
  class_id uuid,
  day_id uuid,
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
    left join public.show_score_class_setups setup on setup.class_id = classes.id
    join public.show_score_scoring_sessions scoring on scoring.class_id = classes.id
    join public.shows duration_shows
      on duration_shows.id = classes.show_id
     and duration_shows.status = 'open'
     and (
       duration_shows.is_public = true
       or duration_shows.show_schedule_public = true
       or duration_shows.show_draw_public = true
       or duration_shows.show_results_public = true
       or duration_shows.is_livestream_public = true
     )
    cross join lateral jsonb_array_elements(
      coalesce(scoring.runs, '[]'::jsonb)
    ) as run(value)
  ),
  pattern_averages as (
    select
      pattern,
      avg(duration_seconds) filter (
        where duration_seconds >= greatest(min_duration_seconds, 0)
          and duration_seconds <= 540
      ) as average_run_seconds
    from run_durations
    group by pattern
  ),
  class_metrics as (
    select
      classes.id,
      classes.show_day_id,
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
    join public.shows target_show
      on target_show.id = classes.show_id
     and target_show.status = 'open'
     and (
       target_show.is_public = true
       or target_show.show_schedule_public = true
       or target_show.show_draw_public = true
       or target_show.show_results_public = true
       or target_show.is_livestream_public = true
     )
    left join public.show_score_class_setups setup on setup.class_id = classes.id
    left join public.show_score_scoring_sessions scoring on scoring.class_id = classes.id
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
          and duration_seconds <= 540
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
                  (run.value->>'startedAt')::timestamptz
                  - (run.value->>'completedAt')::timestamptz
                )
              ) * -1
            else null
          end as duration_seconds
        from jsonb_array_elements(coalesce(scoring.runs, '[]'::jsonb)) as run(value)
      ) durations
    ) class_average
    where classes.show_id = target_show_id
      and classes.is_public = true
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
    join public.show_score_publication_states publication
      on publication.class_id = class_remaining.id
     and publication.status in (
       'live',
       'live_no_score',
       'live_scoring',
       'live_finished'
     )
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
      on class_remaining.show_day_id = live_classes.show_day_id
     and class_remaining.sort_order >= live_classes.sort_order
    group by live_classes.id
  )
  select
    live_classes.id as class_id,
    live_classes.show_day_id as day_id,
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

grant execute on function public.public_show_timing_summary(uuid, integer)
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
