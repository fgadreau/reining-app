-- ShowScore association-level test tools.
-- Additive only: existing organizations remain production associations.

alter table public.organizations
  add column if not exists is_test_mode boolean not null default false;

notify pgrst, 'reload schema';
