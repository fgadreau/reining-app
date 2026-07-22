-- One public livestream link per calendar day of a show.
-- The legacy livestream_url column remains available during the transition.

alter table public.shows
  add column if not exists livestream_urls_by_date jsonb
  not null default '{}'::jsonb;

-- Preserve an existing single livestream by assigning it to the first show
-- date. Managers can then review and complete the remaining daily links.
update public.shows
set livestream_urls_by_date = jsonb_build_object(
  start_date::text,
  livestream_url
)
where coalesce(livestream_urls_by_date, '{}'::jsonb) = '{}'::jsonb
  and start_date is not null
  and nullif(btrim(livestream_url), '') is not null;
