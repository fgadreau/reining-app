-- Reining App V2 paid warmups migration
-- Run this once in Supabase SQL editor for existing projects.
-- Paid warmups are separate from scored classes: they keep the rider order,
-- time allowed per rider, drag settings, and simple status counts.

create table if not exists public.paid_warmups (
  id text primary key,
  association_id text not null references public.associations(id) on delete cascade,
  show_id text not null references public.shows(id) on delete cascade,
  day_id text not null references public.days(id) on delete cascade,
  name text not null,
  arena text,
  duration_minutes_per_rider integer not null default 5,
  drag_interval integer,
  drag_duration_minutes integer not null default 8,
  entries jsonb not null default '[]'::jsonb,
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.paid_warmups
add column if not exists arena text;

alter table public.paid_warmups
add column if not exists is_public_live boolean not null default false;

alter table public.paid_warmups
add column if not exists active_entry_id text;

alter table public.paid_warmups
add column if not exists active_started_at timestamptz;

drop trigger if exists paid_warmups_set_updated_at on public.paid_warmups;
create trigger paid_warmups_set_updated_at
before update on public.paid_warmups
for each row execute function public.set_updated_at();

alter table public.paid_warmups enable row level security;

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

drop policy if exists "Anyone can read shows with public classes" on public.shows;
create policy "Anyone can read shows with public classes"
on public.shows for select to anon, authenticated
using (
  public.show_has_public_class(id)
  or public.show_has_public_paid_warmup(id)
);

drop policy if exists "Anyone can read days with public classes" on public.days;
create policy "Anyone can read days with public classes"
on public.days for select to anon, authenticated
using (
  public.day_has_public_class(id)
  or public.day_has_public_paid_warmup(id)
);

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
      and tablename = 'paid_warmups'
  ) then
    alter publication supabase_realtime add table public.paid_warmups;
  end if;
end $$;
