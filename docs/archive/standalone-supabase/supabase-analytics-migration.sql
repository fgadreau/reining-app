-- ShowScore analytics and audit log migration.
-- Run this once in Supabase SQL editor for existing projects.
--
-- Analytics events are general product usage signals.
-- Audit events are action logs scoped to an association when possible.

create extension if not exists pgcrypto;

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('analytics', 'audit')),
  event_name text not null,
  association_id text,
  show_id text,
  day_id text,
  class_id text,
  session_id text,
  actor_user_id uuid,
  actor_email text,
  path text,
  user_agent text,
  locale text,
  timezone text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_at_idx
on public.app_events (created_at desc);

create index if not exists app_events_event_type_created_at_idx
on public.app_events (event_type, created_at desc);

create index if not exists app_events_association_created_at_idx
on public.app_events (association_id, created_at desc)
where association_id is not null;

create index if not exists app_events_actor_user_created_at_idx
on public.app_events (actor_user_id, created_at desc)
where actor_user_id is not null;

alter table public.app_events enable row level security;

create or replace function public.record_app_event(
  target_event_type text,
  target_event_name text,
  target_association_id text default null,
  target_show_id text default null,
  target_day_id text default null,
  target_class_id text default null,
  target_session_id text default null,
  target_path text default null,
  target_user_agent text default null,
  target_locale text default null,
  target_timezone text default null,
  target_metadata jsonb default '{}'::jsonb
)
returns uuid as $$
declare
  created_event_id uuid;
  normalized_event_type text;
  normalized_event_name text;
begin
  normalized_event_type := lower(nullif(btrim(target_event_type), ''));
  normalized_event_name := lower(nullif(btrim(target_event_name), ''));

  if normalized_event_type not in ('analytics', 'audit') then
    raise exception 'Invalid app event type'
      using errcode = '22023';
  end if;

  if normalized_event_name is null then
    raise exception 'App event name is required'
      using errcode = '22023';
  end if;

  insert into public.app_events (
    event_type,
    event_name,
    association_id,
    show_id,
    day_id,
    class_id,
    session_id,
    actor_user_id,
    actor_email,
    path,
    user_agent,
    locale,
    timezone,
    metadata
  )
  values (
    normalized_event_type,
    left(normalized_event_name, 120),
    nullif(btrim(target_association_id), ''),
    nullif(btrim(target_show_id), ''),
    nullif(btrim(target_day_id), ''),
    nullif(btrim(target_class_id), ''),
    nullif(btrim(target_session_id), ''),
    auth.uid(),
    nullif(auth.email(), ''),
    left(nullif(btrim(target_path), ''), 500),
    left(nullif(target_user_agent, ''), 500),
    left(nullif(btrim(target_locale), ''), 40),
    left(nullif(btrim(target_timezone), ''), 80),
    coalesce(target_metadata, '{}'::jsonb)
  )
  returning id into created_event_id;

  return created_event_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.record_app_event(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to anon, authenticated;

drop policy if exists "Platform admins can read app events" on public.app_events;
create policy "Platform admins can read app events"
on public.app_events for select to authenticated
using (public.current_user_is_platform_admin());

drop policy if exists "Association managers can read association audit events" on public.app_events;
create policy "Association managers can read association audit events"
on public.app_events for select to authenticated
using (
  event_type = 'audit'
  and association_id is not null
  and public.current_user_can_manage_association(association_id)
);
