-- Multi-judges foundation for ShowScore.
-- Run this once on an existing Supabase project before using multi-judge scoring.

alter table public.class_setups
add column if not exists judges jsonb not null default '[{"id":"judge-1","name":"","order":1}]'::jsonb;

create table if not exists public.judge_scoring_sessions (
  class_id text not null references public.classes(id) on delete cascade,
  judge_id text not null,
  judge_name text,
  claimed_by text,
  claimed_by_email text,
  claimed_at timestamptz,
  runs jsonb not null default '[]'::jsonb,
  active_manoeuvre jsonb,
  judge_signature text,
  finalized boolean not null default false,
  finalized_at timestamptz,
  judge_signed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (class_id, judge_id)
);

drop trigger if exists judge_scoring_sessions_set_updated_at on public.judge_scoring_sessions;
create trigger judge_scoring_sessions_set_updated_at
before update on public.judge_scoring_sessions
for each row execute function public.set_updated_at();

alter table public.judge_scoring_sessions enable row level security;

drop policy if exists "Members can read judge scoring sessions" on public.judge_scoring_sessions;
create policy "Members can read judge scoring sessions"
on public.judge_scoring_sessions for select to authenticated
using (public.current_user_can_read_class(class_id));

drop policy if exists "Anyone can read live judge scoring sessions" on public.judge_scoring_sessions;
create policy "Anyone can read live judge scoring sessions"
on public.judge_scoring_sessions for select to anon, authenticated
using (
  exists (
    select 1
    from public.publication_states ps
    where ps.class_id = judge_scoring_sessions.class_id
      and ps.status in (
        'live',
        'live_no_score',
        'live_scoring',
        'live_finished'
      )
  )
);

drop policy if exists "Scoring roles can insert judge scoring sessions" on public.judge_scoring_sessions;
create policy "Scoring roles can insert judge scoring sessions"
on public.judge_scoring_sessions for insert to authenticated
with check (public.current_user_can_score_class(class_id));

drop policy if exists "Scoring roles can update judge scoring sessions" on public.judge_scoring_sessions;
create policy "Scoring roles can update judge scoring sessions"
on public.judge_scoring_sessions for update to authenticated
using (public.current_user_can_score_class(class_id))
with check (public.current_user_can_score_class(class_id));

drop policy if exists "Managers can delete judge scoring sessions" on public.judge_scoring_sessions;
create policy "Managers can delete judge scoring sessions"
on public.judge_scoring_sessions for delete to authenticated
using (public.current_user_can_manage_class(class_id));

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'judge_scoring_sessions'
    ) then
      alter publication supabase_realtime add table public.judge_scoring_sessions;
    end if;
  end if;
end $$;
