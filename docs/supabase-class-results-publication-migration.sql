-- ShowScore class-results publication migration
-- Run this once in Supabase SQL editor for existing projects.
-- Adds:
-- - block class metadata on class setups for Funware grouped draws;
-- - independent public result publication snapshots;
-- - public visibility rules for results that are published without scoresheets.

alter table public.class_setups
add column if not exists block_classes jsonb not null default '[]'::jsonb;

create table if not exists public.class_result_publications (
  class_id text primary key references public.classes(id) on delete cascade,
  status text not null default 'hidden'
    check (status in ('hidden', 'published')),
  published_at timestamptz,
  published_by text,
  result_groups jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists class_result_publications_set_updated_at
on public.class_result_publications;
create trigger class_result_publications_set_updated_at
before update on public.class_result_publications
for each row execute function public.set_updated_at();

alter table public.class_result_publications enable row level security;

drop policy if exists "Members can read class result publications"
on public.class_result_publications;
create policy "Members can read class result publications"
on public.class_result_publications for select to authenticated
using (public.current_user_can_read_class(class_id));

drop policy if exists "Managers can insert class result publications"
on public.class_result_publications;
create policy "Managers can insert class result publications"
on public.class_result_publications for insert to authenticated
with check (public.current_user_can_manage_class(class_id));

drop policy if exists "Managers can update class result publications"
on public.class_result_publications;
create policy "Managers can update class result publications"
on public.class_result_publications for update to authenticated
using (public.current_user_can_manage_class(class_id))
with check (public.current_user_can_manage_class(class_id));

drop policy if exists "Managers can delete class result publications"
on public.class_result_publications;
create policy "Managers can delete class result publications"
on public.class_result_publications for delete to authenticated
using (public.current_user_can_manage_class(class_id));

create or replace function public.class_has_published_result(
  target_class_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.class_result_publications rp
    where rp.class_id = target_class_id
      and rp.status = 'published'
      and jsonb_array_length(coalesce(rp.result_groups, '[]'::jsonb)) > 0
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "Anyone can read published class result publications"
on public.class_result_publications;
create policy "Anyone can read published class result publications"
on public.class_result_publications for select to anon, authenticated
using (public.class_has_published_result(class_id));

create or replace function public.class_is_publicly_visible(
  target_class_id text
)
returns boolean as $$
  select public.class_has_published_official_result(target_class_id)
    or public.class_has_published_result(target_class_id)
    or exists (
      select 1
      from public.publication_states ps
      where ps.class_id = target_class_id
        and ps.status in (
          'live',
          'live_no_score',
          'live_scoring',
          'live_finished'
        )
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
      and tablename = 'class_result_publications'
  ) then
    alter publication supabase_realtime
    add table public.class_result_publications;
  end if;
end $$;
