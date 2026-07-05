-- ShowScore association championship seasons
-- Run once in Supabase SQL editor for the shared HSP/ShowScore project.
--
-- Model:
-- - show_score_championship_seasons stores the full manager/admin payload,
--   including CSV import batches and validation details.
-- - show_score_public_championship_seasons stores only the published public
--   snapshot used by the association showcase.

begin;

create or replace function public.showscore_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.showscore_current_user_can_manage_organization(
  target_organization_id text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  can_manage boolean := false;
  manager_roles text[] := array['admin', 'secretary', 'organizer', 'owner'];
begin
  if auth.uid() is null then
    return false;
  end if;

  if to_regprocedure('public.current_user_can_manage_association(text)') is not null then
    execute 'select public.current_user_can_manage_association($1)'
      into can_manage
      using target_organization_id;

    if can_manage then
      return true;
    end if;
  end if;

  if to_regclass('public.association_memberships') is not null then
    execute
      'select exists (
         select 1
         from public.association_memberships membership
         where membership.association_id::text = $1
           and membership.user_id = auth.uid()
           and membership.role = any($2)
       )'
      into can_manage
      using target_organization_id, manager_roles;

    if can_manage then
      return true;
    end if;
  end if;

  if to_regclass('public.organization_members') is not null then
    execute
      'select exists (
         select 1
         from public.organization_members member
         where member.organization_id::text = $1
           and member.user_id = auth.uid()
           and member.role = any($2)
       )'
      into can_manage
      using target_organization_id, manager_roles;

    if can_manage then
      return true;
    end if;
  end if;

  return false;
end;
$$;

create table if not exists public.show_score_championship_seasons (
  id text primary key,
  organization_id text not null,
  title text not null default '',
  season_year text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'final')),
  season_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_show_score_championship_seasons_org_updated
on public.show_score_championship_seasons (organization_id, updated_at desc);

drop trigger if exists show_score_championship_seasons_touch_updated_at
on public.show_score_championship_seasons;
create trigger show_score_championship_seasons_touch_updated_at
before update on public.show_score_championship_seasons
for each row execute function public.showscore_set_updated_at();

create table if not exists public.show_score_public_championship_seasons (
  season_id text primary key,
  organization_id text not null,
  title text not null default '',
  season_year text not null default '',
  status text not null
    check (status in ('published', 'final')),
  public_payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_show_score_public_championship_seasons_org_updated
on public.show_score_public_championship_seasons (organization_id, updated_at desc);

drop trigger if exists show_score_public_championship_seasons_touch_updated_at
on public.show_score_public_championship_seasons;
create trigger show_score_public_championship_seasons_touch_updated_at
before update on public.show_score_public_championship_seasons
for each row execute function public.showscore_set_updated_at();

alter table public.show_score_championship_seasons enable row level security;
alter table public.show_score_public_championship_seasons enable row level security;

drop policy if exists "ShowScore managers read championship seasons"
on public.show_score_championship_seasons;
create policy "ShowScore managers read championship seasons"
on public.show_score_championship_seasons for select to authenticated
using (public.showscore_current_user_can_manage_organization(organization_id));

drop policy if exists "ShowScore managers insert championship seasons"
on public.show_score_championship_seasons;
create policy "ShowScore managers insert championship seasons"
on public.show_score_championship_seasons for insert to authenticated
with check (public.showscore_current_user_can_manage_organization(organization_id));

drop policy if exists "ShowScore managers update championship seasons"
on public.show_score_championship_seasons;
create policy "ShowScore managers update championship seasons"
on public.show_score_championship_seasons for update to authenticated
using (public.showscore_current_user_can_manage_organization(organization_id))
with check (public.showscore_current_user_can_manage_organization(organization_id));

drop policy if exists "ShowScore managers delete championship seasons"
on public.show_score_championship_seasons;
create policy "ShowScore managers delete championship seasons"
on public.show_score_championship_seasons for delete to authenticated
using (public.showscore_current_user_can_manage_organization(organization_id));

drop policy if exists "Anyone can read published championship seasons"
on public.show_score_public_championship_seasons;
create policy "Anyone can read published championship seasons"
on public.show_score_public_championship_seasons for select to anon, authenticated
using (status in ('published', 'final'));

drop policy if exists "ShowScore managers insert public championship seasons"
on public.show_score_public_championship_seasons;
create policy "ShowScore managers insert public championship seasons"
on public.show_score_public_championship_seasons for insert to authenticated
with check (
  status in ('published', 'final')
  and public.showscore_current_user_can_manage_organization(organization_id)
);

drop policy if exists "ShowScore managers update public championship seasons"
on public.show_score_public_championship_seasons;
create policy "ShowScore managers update public championship seasons"
on public.show_score_public_championship_seasons for update to authenticated
using (public.showscore_current_user_can_manage_organization(organization_id))
with check (
  status in ('published', 'final')
  and public.showscore_current_user_can_manage_organization(organization_id)
);

drop policy if exists "ShowScore managers delete public championship seasons"
on public.show_score_public_championship_seasons;
create policy "ShowScore managers delete public championship seasons"
on public.show_score_public_championship_seasons for delete to authenticated
using (public.showscore_current_user_can_manage_organization(organization_id));

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
        and tablename = 'show_score_public_championship_seasons'
    ) then
      alter publication supabase_realtime
      add table public.show_score_public_championship_seasons;
    end if;
  end if;
end $$;

commit;
