-- Run this after docs/supabase-schema.sql in each Supabase project.
-- Replace the email with the account that should be able to troubleshoot
-- every association in that Supabase project.

insert into public.platform_admins (id, email)
select id, email
from auth.users
where lower(email) = lower('your@email.com')
on conflict (id) do update set email = excluded.email;
