-- Reining App V2 public schedule migration
-- Run this once in Supabase SQL editor for existing projects.
-- Adds planned start times on classes/paid warmups and an optional public show schedule.

alter table public.shows
add column if not exists is_schedule_public boolean not null default false;

alter table public.classes
add column if not exists schedule_start_mode text not null default 'after_previous';

alter table public.classes
add column if not exists schedule_start_time text;

alter table public.paid_warmups
add column if not exists schedule_start_mode text not null default 'after_previous';

alter table public.paid_warmups
add column if not exists schedule_start_time text;

create or replace function public.class_is_public_schedule_item(
  target_class_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.classes c
    join public.shows s on s.id = c.show_id
    where c.id = target_class_id
      and s.is_schedule_public is true
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.paid_warmup_is_public_schedule_item(
  target_paid_warmup_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.paid_warmups p
    join public.shows s on s.id = p.show_id
    where p.id = target_paid_warmup_id
      and s.is_schedule_public is true
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.show_has_public_schedule(
  target_show_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.shows s
    where s.id = target_show_id
      and s.is_schedule_public is true
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.day_has_public_schedule(
  target_day_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.days d
    join public.shows s on s.id = d.show_id
    where d.id = target_day_id
      and s.is_schedule_public is true
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.association_has_public_schedule(
  target_association_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.shows s
    where s.association_id = target_association_id
      and s.is_schedule_public is true
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "Anyone can read associations with public classes" on public.associations;
create policy "Anyone can read associations with public classes"
on public.associations for select to anon, authenticated
using (
  public.association_has_public_class(id)
  or public.association_has_public_paid_warmup(id)
  or public.association_has_public_livestream(id)
  or public.association_has_public_schedule(id)
);

drop policy if exists "Anyone can read shows with public classes" on public.shows;
create policy "Anyone can read shows with public classes"
on public.shows for select to anon, authenticated
using (
  public.show_has_public_class(id)
  or public.show_has_public_paid_warmup(id)
  or public.show_has_public_livestream(id)
  or public.show_has_public_schedule(id)
);

drop policy if exists "Anyone can read days with public classes" on public.days;
create policy "Anyone can read days with public classes"
on public.days for select to anon, authenticated
using (
  public.day_has_public_class(id)
  or public.day_has_public_paid_warmup(id)
  or public.day_has_public_schedule(id)
);

drop policy if exists "Anyone can read published classes" on public.classes;
drop policy if exists "Anyone can read public classes" on public.classes;
create policy "Anyone can read public classes"
on public.classes for select to anon, authenticated
using (
  public.class_is_publicly_visible(id)
  or public.class_is_public_schedule_item(id)
);

drop policy if exists "Anyone can read public schedule paid warmups" on public.paid_warmups;
create policy "Anyone can read public schedule paid warmups"
on public.paid_warmups for select to anon, authenticated
using (public.paid_warmup_is_public_schedule_item(id));
