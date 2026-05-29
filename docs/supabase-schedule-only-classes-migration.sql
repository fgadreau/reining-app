-- ShowScore schedule-only classes migration
-- Run this once in Supabase SQL editor for existing projects.
-- Adds live/schedule details for classes without a scoring pattern.

alter table public.class_setups
add column if not exists schedule_details jsonb not null default '{}'::jsonb;

create or replace function public.update_class_schedule_details(
  target_class_id text,
  next_schedule_details jsonb
)
returns public.class_setups as $$
declare
  saved_setup public.class_setups;
begin
  if not exists (
    select 1
    from public.classes c
    where c.id = target_class_id
      and public.current_user_has_association_role(
        c.association_id,
        array['admin', 'secretary', 'announcer']
      )
  ) then
    raise exception 'Not allowed to update class schedule details.';
  end if;

  insert into public.class_setups (
    class_id,
    pattern,
    schedule_details
  )
  values (
    target_class_id,
    'NO_PATTERN',
    coalesce(next_schedule_details, '{}'::jsonb)
  )
  on conflict (class_id) do update
  set schedule_details = coalesce(excluded.schedule_details, '{}'::jsonb),
      pattern = coalesce(nullif(public.class_setups.pattern, ''), 'NO_PATTERN')
  returning * into saved_setup;

  return saved_setup;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function public.update_class_schedule_details(text, jsonb)
to authenticated;

