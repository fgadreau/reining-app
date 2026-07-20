-- ShowScore announcer live fallback.
--
-- Current production compatibility model:
--   classes.id / show_score_*.class_id represents a scoring block.
-- When the pending HSP blocks/classes rebuild is eventually deployed, this
-- table and the related setup columns must be remapped from class_id to block_id.

alter table public.show_score_class_setups
  add column if not exists live_data_source text not null default 'scribe',
  add column if not exists live_display_mode text not null default 'full',
  add column if not exists qualified_rider_count integer,
  add column if not exists live_source_changed_at timestamptz,
  add column if not exists live_source_changed_by uuid;

alter table public.show_score_class_setups
  drop constraint if exists show_score_class_setups_live_data_source_check;

alter table public.show_score_class_setups
  add constraint show_score_class_setups_live_data_source_check
  check (live_data_source in ('scribe', 'announcer'));

alter table public.show_score_class_setups
  drop constraint if exists show_score_class_setups_live_display_mode_check;

alter table public.show_score_class_setups
  add constraint show_score_class_setups_live_display_mode_check
  check (live_display_mode in ('full', 'order_only'));

alter table public.show_score_class_setups
  drop constraint if exists show_score_class_setups_qualified_rider_count_check;

alter table public.show_score_class_setups
  add constraint show_score_class_setups_qualified_rider_count_check
  check (qualified_rider_count is null or qualified_rider_count > 0);

create or replace function public.set_show_score_live_display_mode(
  target_class_id uuid,
  target_mode text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_mode not in ('full', 'order_only') then
    raise exception 'Invalid live display mode';
  end if;

  if not exists (
    select 1
    from public.classes class_record
    join public.shows show_record on show_record.id = class_record.show_id
    where class_record.id = target_class_id
      and (
        public.is_platform_admin()
        or public.is_org_member(
          show_record.organization_id,
          array['admin', 'secretary', 'announcer']
        )
        or public.has_show_role(
          show_record.id,
          array['organizer', 'secretary', 'announcer']
        )
      )
  ) then
    raise exception 'Insufficient permissions';
  end if;

  update public.show_score_class_setups
  set live_display_mode = target_mode
  where class_id = target_class_id;

  if not found then
    raise exception 'ShowScore class setup not found';
  end if;

  return target_mode;
end;
$$;

revoke all on function public.set_show_score_live_display_mode(uuid, text)
  from public;
grant execute on function public.set_show_score_live_display_mode(uuid, text)
  to authenticated;

create or replace function public.set_show_score_live_data_source(
  target_class_id uuid,
  target_source text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_source not in ('scribe', 'announcer') then
    raise exception 'Invalid live data source';
  end if;

  if not exists (
    select 1
    from public.classes class_record
    join public.shows show_record on show_record.id = class_record.show_id
    where class_record.id = target_class_id
      and (
        public.is_platform_admin()
        or public.is_org_member(
          show_record.organization_id,
          array['admin', 'secretary']
        )
        or public.has_show_role(
          show_record.id,
          array['organizer', 'secretary']
        )
      )
  ) then
    raise exception 'Insufficient permissions';
  end if;

  update public.show_score_class_setups
  set live_data_source = target_source
  where class_id = target_class_id;

  if not found then
    raise exception 'ShowScore class setup not found';
  end if;

  return target_source;
end;
$$;

revoke all on function public.set_show_score_live_data_source(uuid, text)
  from public;
grant execute on function public.set_show_score_live_data_source(uuid, text)
  to authenticated;

create or replace function public.stamp_show_score_live_source_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.live_data_source is distinct from old.live_data_source then
    new.live_source_changed_at := now();
    new.live_source_changed_by := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists stamp_show_score_live_source_change
  on public.show_score_class_setups;
create trigger stamp_show_score_live_source_change
  before update of live_data_source on public.show_score_class_setups
  for each row execute function public.stamp_show_score_live_source_change();

create table if not exists public.show_score_announcer_live_sessions (
  class_id uuid primary key references public.classes(id) on delete cascade,
  runs jsonb not null default '[]'::jsonb,
  active_manoeuvre jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.save_show_score_announcer_live_session(
  target_class_id uuid,
  target_runs jsonb,
  target_active_manoeuvre jsonb,
  target_started_at timestamptz,
  target_completed_at timestamptz,
  target_completed_by uuid,
  target_revision bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
begin
  if not exists (
    select 1
    from public.classes class_record
    join public.shows show_record on show_record.id = class_record.show_id
    join public.show_score_class_setups setup
      on setup.class_id = class_record.id
    where class_record.id = target_class_id
      and setup.live_data_source = 'announcer'
      and (
        public.is_platform_admin()
        or public.is_org_member(
          show_record.organization_id,
          array['admin', 'secretary', 'announcer']
        )
        or public.has_show_role(
          show_record.id,
          array['organizer', 'secretary', 'announcer']
        )
      )
  ) then
    raise exception 'Insufficient permissions or inactive announcer source';
  end if;

  insert into public.show_score_announcer_live_sessions (
    class_id,
    runs,
    active_manoeuvre,
    started_at,
    completed_at,
    completed_by,
    revision
  )
  values (
    target_class_id,
    coalesce(target_runs, '[]'::jsonb),
    target_active_manoeuvre,
    target_started_at,
    target_completed_at,
    target_completed_by,
    coalesce(target_revision, 0)
  )
  on conflict (class_id) do update
  set runs = excluded.runs,
      active_manoeuvre = excluded.active_manoeuvre,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      completed_by = excluded.completed_by,
      revision = excluded.revision
  where excluded.revision >
    show_score_announcer_live_sessions.revision;

  get diagnostics affected_rows = row_count;
  if affected_rows > 0 then
    return true;
  end if;

  return exists (
    select 1
    from public.show_score_announcer_live_sessions current_session
    where current_session.class_id = target_class_id
      and current_session.revision = coalesce(target_revision, 0)
      and current_session.runs is not distinct from
        coalesce(target_runs, '[]'::jsonb)
      and current_session.active_manoeuvre is not distinct from
        target_active_manoeuvre
      and current_session.started_at is not distinct from target_started_at
      and current_session.completed_at is not distinct from target_completed_at
      and current_session.completed_by is not distinct from target_completed_by
  );
end;
$$;

revoke all on function public.save_show_score_announcer_live_session(
  uuid,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  uuid,
  bigint
) from public;
grant execute on function public.save_show_score_announcer_live_session(
  uuid,
  jsonb,
  jsonb,
  timestamptz,
  timestamptz,
  uuid,
  bigint
) to authenticated;

create or replace function public.touch_show_score_announcer_live_session()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_show_score_announcer_live_session
  on public.show_score_announcer_live_sessions;
create trigger touch_show_score_announcer_live_session
  before update on public.show_score_announcer_live_sessions
  for each row execute function public.touch_show_score_announcer_live_session();

alter table public.show_score_announcer_live_sessions enable row level security;

drop policy if exists "ShowScore public can view announcer live sessions"
  on public.show_score_announcer_live_sessions;
create policy "ShowScore public can view announcer live sessions"
  on public.show_score_announcer_live_sessions for select to anon, authenticated
  using (
    public.showscore_public_class_exists(class_id)
    or exists (
      select 1
      from public.classes class_record
      join public.shows show_record on show_record.id = class_record.show_id
      where class_record.id = show_score_announcer_live_sessions.class_id
        and (
          public.is_platform_admin()
          or public.is_org_member(show_record.organization_id)
          or public.has_show_role(show_record.id)
        )
    )
  );

drop policy if exists "ShowScore announcers can insert active live sessions"
  on public.show_score_announcer_live_sessions;
create policy "ShowScore announcers can insert active live sessions"
  on public.show_score_announcer_live_sessions for insert to authenticated
  with check (
    exists (
      select 1
      from public.classes class_record
      join public.shows show_record on show_record.id = class_record.show_id
      join public.show_score_class_setups setup
        on setup.class_id = class_record.id
      where class_record.id = show_score_announcer_live_sessions.class_id
        and setup.live_data_source = 'announcer'
        and (
          public.is_platform_admin()
          or public.is_org_member(
            show_record.organization_id,
            array['admin', 'secretary', 'announcer']
          )
          or public.has_show_role(
            show_record.id,
            array['organizer', 'secretary', 'announcer']
          )
        )
    )
  );

drop policy if exists "ShowScore announcers can update active live sessions"
  on public.show_score_announcer_live_sessions;
create policy "ShowScore announcers can update active live sessions"
  on public.show_score_announcer_live_sessions for update to authenticated
  using (
    exists (
      select 1
      from public.classes class_record
      join public.shows show_record on show_record.id = class_record.show_id
      join public.show_score_class_setups setup
        on setup.class_id = class_record.id
      where class_record.id = show_score_announcer_live_sessions.class_id
        and setup.live_data_source = 'announcer'
        and (
          public.is_platform_admin()
          or public.is_org_member(
            show_record.organization_id,
            array['admin', 'secretary', 'announcer']
          )
          or public.has_show_role(
            show_record.id,
            array['organizer', 'secretary', 'announcer']
          )
        )
    )
  )
  with check (
    exists (
      select 1
      from public.classes class_record
      join public.shows show_record on show_record.id = class_record.show_id
      join public.show_score_class_setups setup
        on setup.class_id = class_record.id
      where class_record.id = show_score_announcer_live_sessions.class_id
        and setup.live_data_source = 'announcer'
        and (
          public.is_platform_admin()
          or public.is_org_member(
            show_record.organization_id,
            array['admin', 'secretary', 'announcer']
          )
          or public.has_show_role(
            show_record.id,
            array['organizer', 'secretary', 'announcer']
          )
        )
    )
  );

grant select on public.show_score_announcer_live_sessions to anon, authenticated;
revoke insert, update on public.show_score_announcer_live_sessions
  from authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'show_score_announcer_live_sessions'
  ) then
    alter publication supabase_realtime
      add table public.show_score_announcer_live_sessions;
  end if;
end;
$$;

notify pgrst, 'reload schema';
