-- Reining App V2 Supabase starter schema
-- Run this in the Supabase SQL editor for a new project.
-- This schema is intentionally JSONB-friendly so V2 can sync current local data
-- before the domain model is fully normalized.

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_profiles_lower_email_idx
on public.user_profiles ((lower(email)))
where email is not null;

create table if not exists public.platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_admins_lower_email_idx
on public.platform_admins ((lower(email)))
where email is not null;

create table if not exists public.associations (
  id text primary key,
  name text not null,
  short_name text,
  timezone text,
  logo_data_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.association_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  association_id text not null references public.associations(id) on delete cascade,
  role text not null check (role in ('admin', 'secretary', 'scribe', 'announcer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, association_id, role)
);

create table if not exists public.association_invitations (
  id uuid primary key default gen_random_uuid(),
  association_id text not null references public.associations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'secretary', 'scribe', 'announcer')),
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'cancelled')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists association_invitations_pending_unique_idx
on public.association_invitations (association_id, (lower(email)), role)
where status = 'pending';

create table if not exists public.shows (
  id text primary key,
  association_id text not null references public.associations(id) on delete cascade,
  name text not null,
  venue text,
  location text,
  start_date date,
  end_date date,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.days (
  id text primary key,
  association_id text not null references public.associations(id) on delete cascade,
  show_id text not null references public.shows(id) on delete cascade,
  label text,
  date date,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.classes (
  id text primary key,
  association_id text not null references public.associations(id) on delete cascade,
  show_id text not null references public.shows(id) on delete cascade,
  day_id text not null references public.days(id) on delete cascade,
  name text not null,
  class_code text,
  pattern text,
  custom_pattern jsonb,
  judge_name text,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.paid_warmups (
  id text primary key,
  association_id text not null references public.associations(id) on delete cascade,
  show_id text not null references public.shows(id) on delete cascade,
  day_id text not null references public.days(id) on delete cascade,
  name text not null,
  duration_minutes_per_rider integer not null default 5,
  drag_interval integer,
  drag_duration_minutes integer not null default 8,
  is_public_live boolean not null default false,
  active_entry_id text,
  active_started_at timestamptz,
  entries jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.classes
add column if not exists custom_pattern jsonb;

create table if not exists public.class_setups (
  class_id text primary key references public.classes(id) on delete cascade,
  pattern text,
  custom_pattern jsonb,
  runs jsonb not null default '[]'::jsonb,
  is_draw_imported boolean not null default false,
  started_at timestamptz,
  drag_interval integer,
  drag_duration_minutes integer not null default 8,
  locked_at timestamptz,
  locked_by text,
  finalized boolean not null default false,
  finalized_at timestamptz,
  judge_name text,
  judge_signature text,
  judge_signed_at timestamptz,
  final_pdf_file_name text,
  updated_at timestamptz not null default now()
);

alter table public.class_setups
add column if not exists started_at timestamptz;

alter table public.class_setups
add column if not exists drag_interval integer;

alter table public.class_setups
add column if not exists drag_duration_minutes integer not null default 8;

alter table public.class_setups
add column if not exists custom_pattern jsonb;

create table if not exists public.scoring_sessions (
  class_id text primary key references public.classes(id) on delete cascade,
  runs jsonb not null default '[]'::jsonb,
  active_manoeuvre jsonb,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.official_results (
  class_id text primary key references public.classes(id) on delete cascade,
  judge_name text,
  judge_signature text,
  finalized boolean not null default false,
  finalized_at timestamptz,
  judge_signed_at timestamptz,
  secretariat_validated_at timestamptz,
  final_pdf_file_name text,
  custom_pattern jsonb,
  official_runs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.official_results
add column if not exists custom_pattern jsonb;

create table if not exists public.publication_states (
  class_id text primary key references public.classes(id) on delete cascade,
  status text not null default 'hidden',
  published_at timestamptz,
  published_by text,
  public_url text,
  visible_fields jsonb not null default '["draw","backNumber","rider","horse","owner","scoreTotal","status"]'::jsonb,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_profiles_set_updated_at on public.user_profiles;
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

drop trigger if exists platform_admins_set_updated_at on public.platform_admins;
create trigger platform_admins_set_updated_at
before update on public.platform_admins
for each row execute function public.set_updated_at();

drop trigger if exists associations_set_updated_at on public.associations;
create trigger associations_set_updated_at
before update on public.associations
for each row execute function public.set_updated_at();

drop trigger if exists association_memberships_set_updated_at on public.association_memberships;
create trigger association_memberships_set_updated_at
before update on public.association_memberships
for each row execute function public.set_updated_at();

drop trigger if exists association_invitations_set_updated_at on public.association_invitations;
create trigger association_invitations_set_updated_at
before update on public.association_invitations
for each row execute function public.set_updated_at();

drop trigger if exists shows_set_updated_at on public.shows;
create trigger shows_set_updated_at
before update on public.shows
for each row execute function public.set_updated_at();

drop trigger if exists days_set_updated_at on public.days;
create trigger days_set_updated_at
before update on public.days
for each row execute function public.set_updated_at();

drop trigger if exists classes_set_updated_at on public.classes;
create trigger classes_set_updated_at
before update on public.classes
for each row execute function public.set_updated_at();

drop trigger if exists paid_warmups_set_updated_at on public.paid_warmups;
create trigger paid_warmups_set_updated_at
before update on public.paid_warmups
for each row execute function public.set_updated_at();

drop trigger if exists class_setups_set_updated_at on public.class_setups;
create trigger class_setups_set_updated_at
before update on public.class_setups
for each row execute function public.set_updated_at();

drop trigger if exists scoring_sessions_set_updated_at on public.scoring_sessions;
create trigger scoring_sessions_set_updated_at
before update on public.scoring_sessions
for each row execute function public.set_updated_at();

drop trigger if exists official_results_set_updated_at on public.official_results;
create trigger official_results_set_updated_at
before update on public.official_results
for each row execute function public.set_updated_at();

drop trigger if exists publication_states_set_updated_at on public.publication_states;
create trigger publication_states_set_updated_at
before update on public.publication_states
for each row execute function public.set_updated_at();

alter table public.associations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.platform_admins enable row level security;
alter table public.association_memberships enable row level security;
alter table public.association_invitations enable row level security;
alter table public.shows enable row level security;
alter table public.days enable row level security;
alter table public.classes enable row level security;
alter table public.paid_warmups enable row level security;
alter table public.class_setups enable row level security;
alter table public.scoring_sessions enable row level security;
alter table public.official_results enable row level security;
alter table public.publication_states enable row level security;

-- Association-scoped access helpers.
-- These SECURITY DEFINER helpers avoid RLS recursion when policies need to check
-- association memberships.
create or replace function public.current_user_is_platform_admin()
returns boolean as $$
  select exists (
    select 1
    from public.platform_admins a
    where a.id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_has_association_role(
  target_association_id text,
  accepted_roles text[]
)
returns boolean as $$
  select public.current_user_is_platform_admin()
    or exists (
      select 1
      from public.association_memberships m
      where m.association_id = target_association_id
        and m.user_id = auth.uid()
        and m.role = any(accepted_roles)
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_is_association_member(
  target_association_id text
)
returns boolean as $$
  select public.current_user_has_association_role(
    target_association_id,
    array['admin', 'secretary', 'scribe', 'announcer']
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_can_manage_association(
  target_association_id text
)
returns boolean as $$
  select public.current_user_has_association_role(
    target_association_id,
    array['admin', 'secretary']
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_can_score_association(
  target_association_id text
)
returns boolean as $$
  select public.current_user_has_association_role(
    target_association_id,
    array['admin', 'secretary', 'scribe']
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_can_admin_association(
  target_association_id text
)
returns boolean as $$
  select public.current_user_has_association_role(
    target_association_id,
    array['admin']
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.association_has_memberships(
  target_association_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.association_memberships m
    where m.association_id = target_association_id
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_has_pending_invitation(
  target_association_id text,
  target_role text
)
returns boolean as $$
  select exists (
    select 1
    from public.association_invitations i
    where i.association_id = target_association_id
      and lower(i.email) = lower(auth.email())
      and i.role = target_role
      and i.status = 'pending'
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_can_read_class(
  target_class_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and public.current_user_is_association_member(c.association_id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_can_score_class(
  target_class_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and public.current_user_can_score_association(c.association_id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.current_user_can_manage_class(
  target_class_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and public.current_user_can_manage_association(c.association_id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.class_has_published_official_result(
  target_class_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.publication_states ps
    join public.official_results official on official.class_id = ps.class_id
    where ps.class_id = target_class_id
      and ps.status = 'published'
      and official.finalized is true
      and official.secretariat_validated_at is not null
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.show_has_published_official_result(
  target_show_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.show_id = target_show_id
      and public.class_has_published_official_result(c.id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.day_has_published_official_result(
  target_day_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    where c.day_id = target_day_id
      and public.class_has_published_official_result(c.id)
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.global_pattern_timing_stats(
  min_duration_seconds integer default 150
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
    ) as timed_run_count,
    avg(run_durations.duration_seconds) filter (
      where run_durations.duration_seconds >= greatest(min_duration_seconds, 0)
    ) as average_run_seconds,
    percentile_cont(0.5) within group (
      order by run_durations.duration_seconds
    ) filter (
      where run_durations.duration_seconds >= greatest(min_duration_seconds, 0)
    ) as median_run_seconds
  from run_durations
  group by run_durations.pattern
  having count(*) filter (
    where run_durations.duration_seconds >= greatest(min_duration_seconds, 0)
  ) > 0
  order by run_durations.pattern;
$$ language sql stable security definer set search_path = public;

grant execute on function public.global_pattern_timing_stats(integer)
to authenticated;

create or replace function public.find_user_profile_for_association(
  target_association_id text,
  target_email text
)
returns table (
  id uuid,
  display_name text,
  email text,
  created_at timestamptz,
  updated_at timestamptz
) as $$
  select p.id, p.display_name, p.email, p.created_at, p.updated_at
  from public.user_profiles p
  where public.current_user_can_admin_association(target_association_id)
    and lower(p.email) = lower(btrim(target_email))
  limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function public.create_association_with_owner(
  target_id text,
  target_name text,
  target_short_name text default null,
  target_timezone text default null,
  target_logo_data_url text default null
)
returns table (
  id text,
  name text,
  short_name text,
  timezone text,
  logo_data_url text
) as $$
declare
  created_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required'
      using errcode = '28000';
  end if;

  if nullif(btrim(target_id), '') is null then
    raise exception 'Association id is required'
      using errcode = '22023';
  end if;

  if nullif(btrim(target_name), '') is null then
    raise exception 'Association name is required'
      using errcode = '22023';
  end if;

  insert into public.associations (
    id,
    name,
    short_name,
    timezone,
    logo_data_url
  )
  values (
    btrim(target_id),
    btrim(target_name),
    nullif(btrim(target_short_name), ''),
    nullif(btrim(target_timezone), ''),
    nullif(target_logo_data_url, '')
  )
  returning associations.id into created_id;

  insert into public.association_memberships (
    user_id,
    association_id,
    role
  )
  values (
    auth.uid(),
    created_id,
    'admin'
  )
  on conflict (user_id, association_id, role) do nothing;

  return query
  select
    a.id,
    a.name,
    a.short_name,
    a.timezone,
    a.logo_data_url
  from public.associations a
  where a.id = created_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.create_association_with_owner(
  text,
  text,
  text,
  text,
  text
) to authenticated;

-- User profile policies.
drop policy if exists "Users can read own profile" on public.user_profiles;
create policy "Users can read own profile"
on public.user_profiles for select to authenticated
using (id = auth.uid());

drop policy if exists "Authenticated users can read profiles for access screens" on public.user_profiles;
drop policy if exists "Admins can read profiles for association memberships" on public.user_profiles;
create policy "Admins can read profiles for association memberships"
on public.user_profiles for select to authenticated
using (
  exists (
    select 1
    from public.association_memberships m
    where m.user_id = user_profiles.id
      and public.current_user_can_admin_association(m.association_id)
  )
);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
on public.user_profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
on public.user_profiles for insert to authenticated
with check (id = auth.uid());

-- Platform admin policies.
-- Optional bootstrap after creating your Auth user:
-- insert into public.platform_admins (id, email)
-- select id, email from auth.users where lower(email) = lower('your@email.com')
-- on conflict (id) do update set email = excluded.email;
drop policy if exists "Platform admins can read platform admins" on public.platform_admins;
create policy "Platform admins can read platform admins"
on public.platform_admins for select to authenticated
using (public.current_user_is_platform_admin());

drop policy if exists "Platform admins can insert platform admins" on public.platform_admins;
create policy "Platform admins can insert platform admins"
on public.platform_admins for insert to authenticated
with check (public.current_user_is_platform_admin());

drop policy if exists "Platform admins can update platform admins" on public.platform_admins;
create policy "Platform admins can update platform admins"
on public.platform_admins for update to authenticated
using (public.current_user_is_platform_admin())
with check (public.current_user_is_platform_admin());

drop policy if exists "Platform admins can delete platform admins" on public.platform_admins;
create policy "Platform admins can delete platform admins"
on public.platform_admins for delete to authenticated
using (public.current_user_is_platform_admin());

-- Association membership policies.
drop policy if exists "Users can read own memberships" on public.association_memberships;
create policy "Users can read own memberships"
on public.association_memberships for select to authenticated
using (user_id = auth.uid());

drop policy if exists "Authenticated users can read memberships for admin screens" on public.association_memberships;
drop policy if exists "Admins can read memberships for their associations" on public.association_memberships;
create policy "Admins can read memberships for their associations"
on public.association_memberships for select to authenticated
using (public.current_user_can_admin_association(association_id));

drop policy if exists "Authenticated users can insert memberships" on public.association_memberships;
drop policy if exists "Admins can insert memberships" on public.association_memberships;
drop policy if exists "Admins and invited users can insert memberships" on public.association_memberships;
create policy "Admins and invited users can insert memberships"
on public.association_memberships for insert to authenticated
with check (
  public.current_user_can_admin_association(association_id)
  or (
    user_id = auth.uid()
    and role = 'admin'
    and not public.association_has_memberships(association_id)
  )
  or (
    user_id = auth.uid()
    and public.current_user_has_pending_invitation(association_id, role)
  )
);

drop policy if exists "Authenticated users can update memberships" on public.association_memberships;
drop policy if exists "Admins can update memberships" on public.association_memberships;
create policy "Admins can update memberships"
on public.association_memberships for update to authenticated
using (public.current_user_can_admin_association(association_id))
with check (public.current_user_can_admin_association(association_id));

drop policy if exists "Authenticated users can delete memberships" on public.association_memberships;
drop policy if exists "Admins can delete memberships" on public.association_memberships;
create policy "Admins can delete memberships"
on public.association_memberships for delete to authenticated
using (public.current_user_can_admin_association(association_id));

-- Invitation policies.
drop policy if exists "Admins can manage association invitations" on public.association_invitations;
create policy "Admins can manage association invitations"
on public.association_invitations for all to authenticated
using (public.current_user_can_admin_association(association_id))
with check (public.current_user_can_admin_association(association_id));

drop policy if exists "Invited users can read own pending invitations" on public.association_invitations;
create policy "Invited users can read own pending invitations"
on public.association_invitations for select to authenticated
using (
  status = 'pending'
  and lower(email) = lower(auth.email())
);

drop policy if exists "Invited users can accept own pending invitations" on public.association_invitations;
create policy "Invited users can accept own pending invitations"
on public.association_invitations for update to authenticated
using (
  status = 'pending'
  and lower(email) = lower(auth.email())
)
with check (
  lower(email) = lower(auth.email())
  and status in ('pending', 'accepted')
  and (accepted_by is null or accepted_by = auth.uid())
);

-- Association policies.
drop policy if exists "Authenticated users can manage associations" on public.associations;
drop policy if exists "Members can read associations" on public.associations;
create policy "Members can read associations"
on public.associations for select to authenticated
using (public.current_user_is_association_member(id));

drop policy if exists "Authenticated users can create associations" on public.associations;
create policy "Authenticated users can create associations"
on public.associations for insert to authenticated
with check (true);

drop policy if exists "Admins can update associations" on public.associations;
create policy "Admins can update associations"
on public.associations for update to authenticated
using (public.current_user_can_admin_association(id))
with check (public.current_user_can_admin_association(id));

drop policy if exists "Admins can delete associations" on public.associations;
create policy "Admins can delete associations"
on public.associations for delete to authenticated
using (public.current_user_can_admin_association(id));

-- Show policies.
drop policy if exists "Authenticated users can manage shows" on public.shows;
drop policy if exists "Members can read shows" on public.shows;
create policy "Members can read shows"
on public.shows for select to authenticated
using (public.current_user_is_association_member(association_id));

drop policy if exists "Managers can insert shows" on public.shows;
create policy "Managers can insert shows"
on public.shows for insert to authenticated
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Managers can update shows" on public.shows;
create policy "Managers can update shows"
on public.shows for update to authenticated
using (public.current_user_can_manage_association(association_id))
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Managers can delete shows" on public.shows;
create policy "Managers can delete shows"
on public.shows for delete to authenticated
using (public.current_user_can_manage_association(association_id));

drop policy if exists "Anyone can read shows with published official results" on public.shows;
create policy "Anyone can read shows with published official results"
on public.shows for select to anon
using (public.show_has_published_official_result(id));

-- Day policies.
drop policy if exists "Authenticated users can manage days" on public.days;
drop policy if exists "Members can read days" on public.days;
create policy "Members can read days"
on public.days for select to authenticated
using (public.current_user_is_association_member(association_id));

drop policy if exists "Managers can insert days" on public.days;
create policy "Managers can insert days"
on public.days for insert to authenticated
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Managers can update days" on public.days;
create policy "Managers can update days"
on public.days for update to authenticated
using (public.current_user_can_manage_association(association_id))
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Managers can delete days" on public.days;
create policy "Managers can delete days"
on public.days for delete to authenticated
using (public.current_user_can_manage_association(association_id));

drop policy if exists "Anyone can read days with published official results" on public.days;
create policy "Anyone can read days with published official results"
on public.days for select to anon
using (public.day_has_published_official_result(id));

-- Class policies.
drop policy if exists "Authenticated users can manage classes" on public.classes;
drop policy if exists "Members can read classes" on public.classes;
create policy "Members can read classes"
on public.classes for select to authenticated
using (public.current_user_is_association_member(association_id));

drop policy if exists "Managers can insert classes" on public.classes;
create policy "Managers can insert classes"
on public.classes for insert to authenticated
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Managers can update classes" on public.classes;
create policy "Managers can update classes"
on public.classes for update to authenticated
using (public.current_user_can_manage_association(association_id))
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Managers can delete classes" on public.classes;
create policy "Managers can delete classes"
on public.classes for delete to authenticated
using (public.current_user_can_manage_association(association_id));

drop policy if exists "Anyone can read published classes" on public.classes;
create policy "Anyone can read published classes"
on public.classes for select to anon
using (public.class_has_published_official_result(id));

-- Paid warmup policies.
drop policy if exists "Members can read paid warmups" on public.paid_warmups;
create policy "Members can read paid warmups"
on public.paid_warmups for select to authenticated
using (public.current_user_is_association_member(association_id));

drop policy if exists "Anyone can read live paid warmups" on public.paid_warmups;
create policy "Anyone can read live paid warmups"
on public.paid_warmups for select to anon, authenticated
using (is_public_live is true);

drop policy if exists "Managers can insert paid warmups" on public.paid_warmups;
create policy "Managers can insert paid warmups"
on public.paid_warmups for insert to authenticated
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Managers can update paid warmups" on public.paid_warmups;
create policy "Managers can update paid warmups"
on public.paid_warmups for update to authenticated
using (public.current_user_can_manage_association(association_id))
with check (public.current_user_can_manage_association(association_id));

drop policy if exists "Announcers can update paid warmup live state" on public.paid_warmups;
create policy "Announcers can update paid warmup live state"
on public.paid_warmups for update to authenticated
using (
  public.current_user_has_association_role(
    association_id,
    array['admin', 'secretary', 'announcer']
  )
)
with check (
  public.current_user_has_association_role(
    association_id,
    array['admin', 'secretary', 'announcer']
  )
);

drop policy if exists "Managers can delete paid warmups" on public.paid_warmups;
create policy "Managers can delete paid warmups"
on public.paid_warmups for delete to authenticated
using (public.current_user_can_manage_association(association_id));

-- Class setup policies.
drop policy if exists "Authenticated users can manage class setups" on public.class_setups;
drop policy if exists "Members can read class setups" on public.class_setups;
create policy "Members can read class setups"
on public.class_setups for select to authenticated
using (public.current_user_can_read_class(class_id));

drop policy if exists "Scoring roles can insert class setups" on public.class_setups;
create policy "Scoring roles can insert class setups"
on public.class_setups for insert to authenticated
with check (public.current_user_can_score_class(class_id));

drop policy if exists "Scoring roles can update class setups" on public.class_setups;
create policy "Scoring roles can update class setups"
on public.class_setups for update to authenticated
using (public.current_user_can_score_class(class_id))
with check (public.current_user_can_score_class(class_id));

drop policy if exists "Managers can delete class setups" on public.class_setups;
create policy "Managers can delete class setups"
on public.class_setups for delete to authenticated
using (public.current_user_can_manage_class(class_id));

-- Scoring policies.
drop policy if exists "Authenticated users can manage scoring sessions" on public.scoring_sessions;
drop policy if exists "Members can read scoring sessions" on public.scoring_sessions;
create policy "Members can read scoring sessions"
on public.scoring_sessions for select to authenticated
using (public.current_user_can_read_class(class_id));

drop policy if exists "Scoring roles can insert scoring sessions" on public.scoring_sessions;
create policy "Scoring roles can insert scoring sessions"
on public.scoring_sessions for insert to authenticated
with check (public.current_user_can_score_class(class_id));

drop policy if exists "Scoring roles can update scoring sessions" on public.scoring_sessions;
create policy "Scoring roles can update scoring sessions"
on public.scoring_sessions for update to authenticated
using (public.current_user_can_score_class(class_id))
with check (public.current_user_can_score_class(class_id));

drop policy if exists "Scoring roles can delete scoring sessions" on public.scoring_sessions;
create policy "Scoring roles can delete scoring sessions"
on public.scoring_sessions for delete to authenticated
using (public.current_user_can_score_class(class_id));

-- Official result policies.
drop policy if exists "Authenticated users can manage official results" on public.official_results;
drop policy if exists "Members can read official results" on public.official_results;
create policy "Members can read official results"
on public.official_results for select to authenticated
using (public.current_user_can_read_class(class_id));

drop policy if exists "Managers can insert official results" on public.official_results;
create policy "Managers can insert official results"
on public.official_results for insert to authenticated
with check (public.current_user_can_manage_class(class_id));

drop policy if exists "Scoring roles can insert unvalidated official results" on public.official_results;
create policy "Scoring roles can insert unvalidated official results"
on public.official_results for insert to authenticated
with check (
  public.current_user_can_score_class(class_id)
  and secretariat_validated_at is null
);

drop policy if exists "Managers can update official results" on public.official_results;
create policy "Managers can update official results"
on public.official_results for update to authenticated
using (public.current_user_can_manage_class(class_id))
with check (public.current_user_can_manage_class(class_id));

drop policy if exists "Scoring roles can update unvalidated official results" on public.official_results;
create policy "Scoring roles can update unvalidated official results"
on public.official_results for update to authenticated
using (
  public.current_user_can_score_class(class_id)
  and secretariat_validated_at is null
)
with check (
  public.current_user_can_score_class(class_id)
  and secretariat_validated_at is null
);

drop policy if exists "Managers can delete official results" on public.official_results;
create policy "Managers can delete official results"
on public.official_results for delete to authenticated
using (public.current_user_can_manage_class(class_id));

-- Publication policies.
drop policy if exists "Authenticated users can manage publication states" on public.publication_states;
drop policy if exists "Members can read publication states" on public.publication_states;
create policy "Members can read publication states"
on public.publication_states for select to authenticated
using (public.current_user_can_read_class(class_id));

drop policy if exists "Managers can insert publication states" on public.publication_states;
create policy "Managers can insert publication states"
on public.publication_states for insert to authenticated
with check (public.current_user_can_manage_class(class_id));

drop policy if exists "Managers can update publication states" on public.publication_states;
create policy "Managers can update publication states"
on public.publication_states for update to authenticated
using (public.current_user_can_manage_class(class_id))
with check (public.current_user_can_manage_class(class_id));

drop policy if exists "Managers can delete publication states" on public.publication_states;
create policy "Managers can delete publication states"
on public.publication_states for delete to authenticated
using (public.current_user_can_manage_class(class_id));

-- Public read policy for published results only.
drop policy if exists "Anyone can read published publication states" on public.publication_states;
create policy "Anyone can read published publication states"
on public.publication_states for select to anon
using (
  status = 'published'
  and public.class_has_published_official_result(class_id)
);

drop policy if exists "Anyone can read published official results" on public.official_results;
create policy "Anyone can read published official results"
on public.official_results for select to anon
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

-- Realtime support for announcer dashboards.
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
    raise notice 'Publication supabase_realtime not found. Enable Realtime in Supabase, then run this block again.';
  end if;
end $$;

-- Public directory support.
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

create or replace function public.show_has_public_paid_warmup(
  target_show_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.paid_warmups p
    where p.show_id = target_show_id
      and p.is_public_live is true
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

create or replace function public.day_has_public_paid_warmup(
  target_day_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.paid_warmups p
    where p.day_id = target_day_id
      and p.is_public_live is true
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

create or replace function public.association_has_public_paid_warmup(
  target_association_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.paid_warmups p
    where p.association_id = target_association_id
      and p.is_public_live is true
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "Anyone can read associations with public classes" on public.associations;
create policy "Anyone can read associations with public classes"
on public.associations for select to anon, authenticated
using (
  public.association_has_public_class(id)
  or public.association_has_public_paid_warmup(id)
);

drop policy if exists "Anyone can read shows with published official results" on public.shows;
drop policy if exists "Anyone can read shows with public classes" on public.shows;
create policy "Anyone can read shows with public classes"
on public.shows for select to anon, authenticated
using (
  public.show_has_public_class(id)
  or public.show_has_public_paid_warmup(id)
);

drop policy if exists "Anyone can read days with published official results" on public.days;
drop policy if exists "Anyone can read days with public classes" on public.days;
create policy "Anyone can read days with public classes"
on public.days for select to anon, authenticated
using (
  public.day_has_public_class(id)
  or public.day_has_public_paid_warmup(id)
);

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
      class_average.average_run_seconds as class_average_run_seconds,
      pattern_averages.average_run_seconds as pattern_average_run_seconds,
      scoring.active_manoeuvre is not null as has_active_manoeuvre
    from public.classes
    left join public.class_setups setup on setup.class_id = classes.id
    left join public.scoring_sessions scoring on scoring.class_id = classes.id
    left join pattern_averages on pattern_averages.pattern = coalesce(
      nullif(btrim(setup.pattern), ''),
      nullif(btrim(classes.pattern), ''),
      'Sans pattern'
    )
    cross join lateral (
      select count(*)::integer as completed_runs
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
    now() as estimated_at
  from live_classes
  join day_remaining on day_remaining.live_class_id = live_classes.id
  order by live_classes.live_rank;
$$ language sql stable security definer set search_path = public;

grant execute on function public.public_show_timing_summary(text, integer)
to anon, authenticated;
