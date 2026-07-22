-- ShowScore arena display video storage and show metadata.
-- MP4 files are public to the arena display, while writes remain limited to
-- platform admins, organization admins, and show organizers.

alter table public.shows
  add column if not exists tv_display_video_path text,
  add column if not exists tv_display_video_name text,
  add column if not exists tv_display_video_size bigint,
  add column if not exists tv_display_video_arena text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tv-display-media',
  'tv-display-media',
  true,
  2147483648,
  array['video/mp4']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- The project-wide Storage limit must be raised to support this bucket.
-- Preserve the former 50 MB inherited limit on every existing bucket that
-- does not already define a more specific limit.
update storage.buckets
set file_size_limit = 52428800
where id <> 'tv-display-media'
  and file_size_limit is null;

drop policy if exists "Public can view TV display media" on storage.objects;
create policy "Public can view TV display media"
on storage.objects
for select
to public
using (bucket_id = 'tv-display-media');

create or replace function public.showscore_can_manage_tv_display_object(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      and split_part(object_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then exists (
      select 1
      from public.shows
      where shows.id::text = split_part(object_name, '/', 2)
        and shows.organization_id::text = split_part(object_name, '/', 1)
        and (
          public.is_platform_admin()
          or public.is_org_member(shows.organization_id, array['admin', 'secretary']::text[])
          or public.has_show_role(shows.id, array['organizer']::text[])
        )
    )
    else false
  end;
$$;

revoke all on function public.showscore_can_manage_tv_display_object(text)
  from public;
grant execute on function public.showscore_can_manage_tv_display_object(text)
  to authenticated;

drop policy if exists "Show managers can upload TV display media" on storage.objects;
create policy "Show managers can upload TV display media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'tv-display-media'
  and public.showscore_can_manage_tv_display_object(name)
);

drop policy if exists "Show managers can update TV display media" on storage.objects;
create policy "Show managers can update TV display media"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'tv-display-media'
  and public.showscore_can_manage_tv_display_object(name)
)
with check (
  bucket_id = 'tv-display-media'
  and public.showscore_can_manage_tv_display_object(name)
);

drop policy if exists "Show managers can delete TV display media" on storage.objects;
create policy "Show managers can delete TV display media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'tv-display-media'
  and public.showscore_can_manage_tv_display_object(name)
);
