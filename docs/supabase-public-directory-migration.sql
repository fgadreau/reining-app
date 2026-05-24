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
