-- ShowScore championship update email list
-- Run once in Supabase SQL editor for the shared HSP/ShowScore project.
--
-- Model:
-- - subscribers are tied to organization_id, not a season, so people do not
--   need to re-subscribe every year.
-- - campaigns reference the season being announced at send time.
-- - public subscribe/unsubscribe writes are handled by Edge Functions with the
--   service role; managers can only read the list and campaign audit data.

begin;

create extension if not exists pgcrypto;

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

create table if not exists public.show_score_championship_update_subscribers (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  email text not null,
  name text not null default '',
  language text not null default 'fr'
    check (language in ('fr', 'en')),
  status text not null default 'subscribed'
    check (status in ('subscribed', 'unsubscribed')),
  consent_source text not null default '',
  consent_text text not null default '',
  source_url text not null default '',
  unsubscribe_token_hash text,
  unsubscribe_token_issued_at timestamptz,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(email))
);

create unique index if not exists idx_championship_update_subscribers_org_email
on public.show_score_championship_update_subscribers (organization_id, email);

create index if not exists idx_championship_update_subscribers_org_status
on public.show_score_championship_update_subscribers (organization_id, status);

drop trigger if exists championship_update_subscribers_touch_updated_at
on public.show_score_championship_update_subscribers;
create trigger championship_update_subscribers_touch_updated_at
before update on public.show_score_championship_update_subscribers
for each row execute function public.showscore_set_updated_at();

create table if not exists public.show_score_championship_update_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id text not null,
  season_id text not null default '',
  mode text not null default 'campaign'
    check (mode in ('campaign', 'test')),
  subject text not null default '',
  message text not null default '',
  public_url text not null default '',
  sent_by uuid,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  success_count integer not null default 0,
  failure_count integer not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'sending', 'sent', 'partial_failed', 'failed')),
  error_message text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_championship_update_campaigns_org_sent
on public.show_score_championship_update_campaigns (organization_id, sent_at desc);

drop trigger if exists championship_update_campaigns_touch_updated_at
on public.show_score_championship_update_campaigns;
create trigger championship_update_campaigns_touch_updated_at
before update on public.show_score_championship_update_campaigns
for each row execute function public.showscore_set_updated_at();

create table if not exists public.show_score_championship_update_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null
    references public.show_score_championship_update_campaigns(id)
    on delete cascade,
  subscriber_id uuid
    references public.show_score_championship_update_subscribers(id)
    on delete set null,
  email text not null,
  status text not null
    check (status in ('sent', 'failed')),
  resend_id text,
  error_message text not null default '',
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_championship_update_deliveries_campaign
on public.show_score_championship_update_deliveries (campaign_id);

alter table public.show_score_championship_update_subscribers enable row level security;
alter table public.show_score_championship_update_campaigns enable row level security;
alter table public.show_score_championship_update_deliveries enable row level security;

drop policy if exists "ShowScore managers read championship update subscribers"
on public.show_score_championship_update_subscribers;
create policy "ShowScore managers read championship update subscribers"
on public.show_score_championship_update_subscribers for select to authenticated
using (public.showscore_current_user_can_manage_organization(organization_id));

drop policy if exists "ShowScore managers read championship update campaigns"
on public.show_score_championship_update_campaigns;
create policy "ShowScore managers read championship update campaigns"
on public.show_score_championship_update_campaigns for select to authenticated
using (public.showscore_current_user_can_manage_organization(organization_id));

drop policy if exists "ShowScore managers read championship update deliveries"
on public.show_score_championship_update_deliveries;
create policy "ShowScore managers read championship update deliveries"
on public.show_score_championship_update_deliveries for select to authenticated
using (
  exists (
    select 1
    from public.show_score_championship_update_campaigns campaign
    where campaign.id = show_score_championship_update_deliveries.campaign_id
      and public.showscore_current_user_can_manage_organization(
        campaign.organization_id
      )
  )
);

commit;
