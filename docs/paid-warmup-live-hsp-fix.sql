-- Paid warmup live compatibility fix for the shared HSP/ShowScore schema.
-- Run once in the Supabase SQL editor if public paid warmups do not update
-- or the active rider never appears in the public showcase.

alter table public.show_score_paid_warmups
  drop constraint if exists show_score_paid_warmups_active_entry_id_fkey;

alter table public.show_score_paid_warmups
  add column if not exists active_entry_id text;

alter table public.show_score_paid_warmups
  alter column active_entry_id type text using active_entry_id::text;

alter table public.show_score_paid_warmups
  add column if not exists updated_at timestamptz not null default now();

update public.show_score_paid_warmups
set updated_at = now()
where updated_at is null;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'show_score_paid_warmups'
  ) then
    alter publication supabase_realtime add table public.show_score_paid_warmups;
  end if;
end $$;
