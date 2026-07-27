-- Scanned PDF score sheets uploaded by the secretariat, one per source block.
-- The same block document can be displayed on every published class/division
-- result group produced from that block.

create table if not exists public.show_score_class_documents (
  class_id uuid not null references public.classes(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  show_id uuid not null references public.shows(id) on delete cascade,
  document_type text not null default 'scoresheet_scan'
    check (document_type in ('scoresheet_scan')),
  storage_path text not null,
  file_name text not null,
  file_size bigint not null default 0
    check (file_size >= 0 and file_size <= 20971520),
  uploaded_at timestamptz not null default now(),
  uploaded_by uuid,
  primary key (class_id, document_type)
);

create index if not exists show_score_class_documents_show_id_idx
  on public.show_score_class_documents (show_id);

alter table public.show_score_class_documents enable row level security;

create or replace function public.showscore_scanned_scoresheet_is_public(
  target_class_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.classes class_row
    join public.shows show_row
      on show_row.id = class_row.show_id
    join public.class_result_publications result_publication
      on result_publication.class_id = class_row.id
    where class_row.id = target_class_id
      and class_row.is_public = true
      and show_row.status = 'open'
      and show_row.show_results_public = true
      and result_publication.status = 'published'
      and result_publication.result_groups <> '[]'::jsonb
  );
$$;

drop policy if exists "Members can read scanned class scoresheets"
  on public.show_score_class_documents;
create policy "Members can read scanned class scoresheets"
on public.show_score_class_documents
for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_member(organization_id)
  or public.showscore_scanned_scoresheet_is_public(class_id)
);

drop policy if exists "Public can read scanned scoresheets for visible classes"
  on public.show_score_class_documents;
create policy "Public can read scanned scoresheets for visible classes"
on public.show_score_class_documents
for select
to anon, authenticated
using (public.showscore_scanned_scoresheet_is_public(class_id));

drop policy if exists "Managers can insert scanned class scoresheets"
  on public.show_score_class_documents;
create policy "Managers can insert scanned class scoresheets"
on public.show_score_class_documents
for insert
to authenticated
with check (
  (
    public.is_platform_admin()
    or public.is_org_member(
      organization_id,
      array['admin', 'secretary']::text[]
    )
  )
  and exists (
    select 1
    from public.classes class_row
    where class_row.id = show_score_class_documents.class_id
      and class_row.organization_id =
        show_score_class_documents.organization_id
      and class_row.show_id = show_score_class_documents.show_id
  )
);

drop policy if exists "Managers can update scanned class scoresheets"
  on public.show_score_class_documents;
create policy "Managers can update scanned class scoresheets"
on public.show_score_class_documents
for update
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_member(
    organization_id,
    array['admin', 'secretary']::text[]
  )
)
with check (
  (
    public.is_platform_admin()
    or public.is_org_member(
      organization_id,
      array['admin', 'secretary']::text[]
    )
  )
  and exists (
    select 1
    from public.classes class_row
    where class_row.id = show_score_class_documents.class_id
      and class_row.organization_id =
        show_score_class_documents.organization_id
      and class_row.show_id = show_score_class_documents.show_id
  )
);

drop policy if exists "Managers can delete scanned class scoresheets"
  on public.show_score_class_documents;
create policy "Managers can delete scanned class scoresheets"
on public.show_score_class_documents
for delete
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_member(
    organization_id,
    array['admin', 'secretary']::text[]
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'class-scoresheets',
  'class-scoresheets',
  true,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view scanned class scoresheets"
  on storage.objects;
create policy "Public can view scanned class scoresheets"
on storage.objects
for select
to public
using (bucket_id = 'class-scoresheets');

drop policy if exists "Managers can upload scanned class scoresheets"
  on storage.objects;
create policy "Managers can upload scanned class scoresheets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'class-scoresheets'
  and exists (
    select 1
    from public.classes class_row
    where class_row.id = split_part(name, '/', 1)::uuid
      and (
        public.is_platform_admin()
        or public.is_org_member(
          class_row.organization_id,
          array['admin', 'secretary']::text[]
        )
      )
  )
);

drop policy if exists "Managers can replace scanned class scoresheets"
  on storage.objects;
create policy "Managers can replace scanned class scoresheets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'class-scoresheets'
  and exists (
    select 1
    from public.classes class_row
    where class_row.id = split_part(name, '/', 1)::uuid
      and (
        public.is_platform_admin()
        or public.is_org_member(
          class_row.organization_id,
          array['admin', 'secretary']::text[]
        )
      )
  )
)
with check (
  bucket_id = 'class-scoresheets'
  and exists (
    select 1
    from public.classes class_row
    where class_row.id = split_part(name, '/', 1)::uuid
      and (
        public.is_platform_admin()
        or public.is_org_member(
          class_row.organization_id,
          array['admin', 'secretary']::text[]
        )
      )
  )
);

drop policy if exists "Managers can delete scanned class scoresheets"
  on storage.objects;
create policy "Managers can delete scanned class scoresheets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'class-scoresheets'
  and exists (
    select 1
    from public.classes class_row
    where class_row.id = split_part(name, '/', 1)::uuid
      and (
        public.is_platform_admin()
        or public.is_org_member(
          class_row.organization_id,
          array['admin', 'secretary']::text[]
        )
      )
  )
);
