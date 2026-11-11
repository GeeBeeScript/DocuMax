-- Phase 3 — Entities (properties / jobs) and documents.
--
-- Role matrix
--
-- | table     | select | insert                          | update                                      | delete       |
-- | --------- | ------ | ------------------------------- | ------------------------------------------- | ------------ |
-- | entities  | member | owner, admin                    | owner, admin                                | owner, admin |
-- | documents | member | owner, admin, reviewer, member  | writers: entity_id + file_name columns only | owner, admin |
--
-- Document status changes never come from a plain UPDATE: end users go through confirm_document_upload() /
-- retry_document(), the worker through transition_document() (service role only). Each checks the current
-- status, so transitions are idempotent and the status machine in docs/DATA_MODEL.md holds.

-- ---------------------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------------------
create type public.entity_status as enum ('active', 'archived');
create type public.document_status as enum (
  'uploading', 'queued', 'extracting', 'analyzing', 'validating', 'needs_review', 'ready', 'failed'
);

-- ---------------------------------------------------------------------------------------------------------
-- entities
-- ---------------------------------------------------------------------------------------------------------
create table public.entities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind public.entity_kind not null,
  name text not null check (char_length(name) between 1 and 160),
  code text check (code is null or char_length(code) between 1 and 40),
  address text check (address is null or char_length(address) <= 300),
  client_name text check (client_name is null or char_length(client_name) <= 160),
  status public.entity_status not null default 'active',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index entities_org_id_idx on public.entities (org_id, status, name);
create unique index entities_org_code_idx on public.entities (org_id, lower(code)) where code is not null;

/** An entity's kind always matches its organization's mode (properties vs jobs). */
create function public.set_entity_kind() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select o.entity_kind into new.kind from public.organizations o where o.id = new.org_id;
  return new;
end;
$$;

create trigger set_entity_kind before insert or update of kind, org_id on public.entities
  for each row execute function public.set_entity_kind();

-- ---------------------------------------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  entity_id uuid references public.entities (id) on delete set null,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  page_count int check (page_count > 0),
  status public.document_status not null default 'uploading',
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Files live under {org_id}/documents/{document_id}/ (docs/MULTI_TENANCY.md).
  constraint documents_storage_path_check check (storage_path like org_id::text || '/documents/' || id::text || '/%')
);
create index documents_org_created_idx on public.documents (org_id, created_at desc);
create index documents_org_status_idx on public.documents (org_id, status);
create index documents_org_sha_idx on public.documents (org_id, sha256);
create index documents_entity_idx on public.documents (entity_id);

/** A document can only be assigned to an entity of the same organization. */
create function public.check_document_entity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.entity_id is not null and not exists (
    select 1 from public.entities e where e.id = new.entity_id and e.org_id = new.org_id
  ) then
    raise exception 'entity belongs to another organization' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_document_entity before insert or update of entity_id on public.documents
  for each row execute function public.check_document_entity();

-- ---------------------------------------------------------------------------------------------------------
-- Shared triggers
-- ---------------------------------------------------------------------------------------------------------
create trigger set_updated_at before update on public.entities for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.documents for each row execute function public.set_updated_at();
create trigger prevent_org_change before update on public.entities for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.documents for each row execute function public.prevent_org_change();
create trigger audit after insert or update or delete on public.entities for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.documents for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------------------------------------
alter table public.entities enable row level security;
alter table public.entities force row level security;
alter table public.documents enable row level security;
alter table public.documents force row level security;

create policy entities_select on public.entities for select using (public.is_org_member(org_id));
create policy entities_insert on public.entities for insert with check (public.has_org_role(org_id, array['owner', 'admin']));
create policy entities_update on public.entities for update
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));
create policy entities_delete on public.entities for delete using (public.has_org_role(org_id, array['owner', 'admin']));

create policy documents_select on public.documents for select using (public.is_org_member(org_id));
create policy documents_insert on public.documents for insert with check (
  public.has_org_role(org_id, array['owner', 'admin', 'reviewer', 'member'])
  and uploaded_by = auth.uid()
  and status = 'uploading'
  and attempts = 0
  and page_count is null
  and error is null
);
create policy documents_update on public.documents for update
  using (public.has_org_role(org_id, array['owner', 'admin', 'reviewer', 'member']))
  with check (public.has_org_role(org_id, array['owner', 'admin', 'reviewer', 'member']));
create policy documents_delete on public.documents for delete using (public.has_org_role(org_id, array['owner', 'admin']));

-- End users may only edit these document columns directly; status & processing fields go through functions.
revoke update on public.documents from authenticated, anon;
grant update (entity_id, file_name) on public.documents to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Status functions
-- ---------------------------------------------------------------------------------------------------------
/** uploading → queued, after the browser finished the direct upload. Returns the document. */
create function public.confirm_document_upload(p_document uuid) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  select * into v_doc from public.documents d where d.id = p_document for update;
  if v_doc.id is null or not public.has_org_role(v_doc.org_id, array['owner', 'admin', 'reviewer', 'member']) then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_doc.status = 'uploading' then
    update public.documents set status = 'queued', attempts = attempts + 1, error = null
    where id = p_document returning * into v_doc;
  end if;
  return v_doc; -- already confirmed: idempotent no-op
end;
$$;

/** failed → queued (manual retry). Returns the document. */
create function public.retry_document(p_document uuid) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  select * into v_doc from public.documents d where d.id = p_document for update;
  if v_doc.id is null or not public.has_org_role(v_doc.org_id, array['owner', 'admin', 'reviewer', 'member']) then
    raise exception 'document not found' using errcode = 'P0002';
  end if;
  if v_doc.status <> 'failed' then
    raise exception 'only failed documents can be retried' using errcode = '22023';
  end if;
  update public.documents set status = 'queued', attempts = attempts + 1, error = null
  where id = p_document returning * into v_doc;
  return v_doc;
end;
$$;

/**
 * Worker-only transition. Moves the document to p_to only if it is currently in one of p_from (idempotent: a
 * retried job that finds the document already moved on gets null back). Runs with app.actor_id set so the
 * audit log attributes the change to the worker.
 */
create function public.transition_document(
  p_org uuid, p_document uuid, p_from public.document_status[], p_to public.document_status,
  p_error text default null, p_page_count int default null, p_actor uuid default null
) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  perform set_config('app.actor_id', coalesce(p_actor, '00000000-0000-0000-0000-000000000000')::text, true);
  update public.documents d
  set status = p_to,
      error = case when p_to = 'failed' then coalesce(p_error, 'Processing failed') else null end,
      page_count = coalesce(p_page_count, d.page_count)
  where d.id = p_document and d.org_id = p_org and d.status = any (p_from)
  returning * into v_doc;
  return v_doc;
end;
$$;

revoke execute on function public.transition_document from public, anon, authenticated;
grant execute on function public.transition_document to service_role;
revoke execute on function public.confirm_document_upload(uuid) from public, anon;
revoke execute on function public.retry_document(uuid) from public, anon;
grant execute on function public.confirm_document_upload(uuid) to authenticated;
grant execute on function public.retry_document(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Storage limits for the documents bucket (enforced server-side by Storage as well as in the app)
-- ---------------------------------------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'documents';

-- Live status in the UI.
alter publication supabase_realtime add table public.documents;
