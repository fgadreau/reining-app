-- Run this after the schema/migrations in each Supabase project.
-- Replace the email with the account that should be able to troubleshoot
-- every association in that Supabase project.

do $$
declare
  target_email text := 'your@email.com';
  target_auth_user_id uuid;
  target_profile_id uuid;
  has_hsp_platform_admins boolean;
  has_standalone_platform_admins boolean;
begin
  select id
    into target_auth_user_id
  from auth.users
  where lower(email) = lower(target_email)
  limit 1;

  if target_auth_user_id is null then
    raise exception 'No auth.users row found for %', target_email;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_admins'
      and column_name = 'user_id'
  )
    into has_hsp_platform_admins;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_admins'
      and column_name = 'id'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'platform_admins'
      and column_name = 'email'
  )
    into has_standalone_platform_admins;

  if has_hsp_platform_admins then
    execute
      'select id from public.user_profiles where user_id = $1 limit 1'
      into target_profile_id
      using target_auth_user_id;

    if target_profile_id is null then
      raise exception
        'No public.user_profiles row found for auth user %. Sign in once before bootstrapping the admin.',
        target_email;
    end if;

    execute
      'insert into public.platform_admins (user_id) values ($1) on conflict (user_id) do nothing'
      using target_profile_id;
  elsif has_standalone_platform_admins then
    execute
      'insert into public.platform_admins (id, email)
       values ($1, $2)
       on conflict (id) do update set email = excluded.email'
      using target_auth_user_id, target_email;
  else
    raise exception 'Unsupported public.platform_admins shape.';
  end if;
end $$;
