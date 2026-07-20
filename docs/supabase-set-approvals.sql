-- ShowScore signed set approvals.
-- This is an additive production-safe extension of the shared HSP tables.

alter table public.show_score_class_setups
  add column if not exists set_approval_mode text not null default 'class_end',
  add column if not exists set_approvals jsonb not null default '[]'::jsonb;

alter table public.show_score_class_setups
  drop constraint if exists show_score_class_setups_set_approval_mode_check;

alter table public.show_score_class_setups
  add constraint show_score_class_setups_set_approval_mode_check
  check (set_approval_mode in ('per_set', 'class_end'));

alter table public.show_score_judge_sessions
  add column if not exists set_approvals jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
