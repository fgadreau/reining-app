-- ShowScore public livestream and OBS overlay migration
-- Run this once in Supabase SQL editor for existing projects.
-- Adds:
-- - show-level public livestream settings;
-- - association sponsor logos used by the OBS overlay right rail.

alter table public.shows
add column if not exists livestream_url text;

alter table public.shows
add column if not exists is_livestream_public boolean not null default false;

alter table public.associations
add column if not exists sponsor_logos jsonb not null default '[]'::jsonb;

create or replace function public.show_has_public_livestream(
  target_show_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.shows s
    where s.id = target_show_id
      and s.is_livestream_public is true
      and nullif(btrim(coalesce(s.livestream_url, '')), '') is not null
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.association_has_public_livestream(
  target_association_id text
)
returns boolean as $$
  select exists (
    select 1
    from public.shows s
    where s.association_id = target_association_id
      and public.show_has_public_livestream(s.id)
  );
$$ language sql stable security definer set search_path = public;

drop policy if exists "Anyone can read associations with public classes" on public.associations;
create policy "Anyone can read associations with public classes"
on public.associations for select to anon, authenticated
using (
  public.association_has_public_class(id)
  or public.association_has_public_paid_warmup(id)
  or public.association_has_public_livestream(id)
);

drop policy if exists "Anyone can read shows with published official results" on public.shows;
drop policy if exists "Anyone can read shows with public classes" on public.shows;
create policy "Anyone can read shows with public classes"
on public.shows for select to anon, authenticated
using (
  public.show_has_public_class(id)
  or public.show_has_public_paid_warmup(id)
  or public.show_has_public_livestream(id)
);

drop function if exists public.create_association_with_owner(
  text,
  text,
  text,
  text,
  text,
  text
);

drop function if exists public.create_association_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

create or replace function public.create_association_with_owner(
  target_id text,
  target_name text,
  target_short_name text default null,
  target_timezone text default null,
  target_logo_data_url text default null,
  target_website_url text default null,
  target_sponsor_logos jsonb default '[]'::jsonb
)
returns table (
  id text,
  name text,
  short_name text,
  timezone text,
  logo_data_url text,
  website_url text,
  sponsor_logos jsonb
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
    logo_data_url,
    website_url,
    sponsor_logos
  )
  values (
    btrim(target_id),
    btrim(target_name),
    nullif(btrim(target_short_name), ''),
    nullif(btrim(target_timezone), ''),
    nullif(target_logo_data_url, ''),
    nullif(btrim(target_website_url), ''),
    coalesce(target_sponsor_logos, '[]'::jsonb)
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
    a.logo_data_url,
    a.website_url,
    a.sponsor_logos
  from public.associations a
  where a.id = created_id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.create_association_with_owner(
  text,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
