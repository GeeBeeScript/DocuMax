-- Phase 9 — CSV imports of records.
--
-- | table   | select | writes                                                                               |
-- | ------- | ------ | ------------------------------------------------------------------------------------ |
-- | imports | member | create: writers (uploaded file under {org}/imports/); start_import(): writers (approve |
-- |         |        | on import: owner/admin/reviewer); the worker (service role) processes and finishes   |
--
-- Imported records are ordinary records (source = 'import', import_id set, no document): they are validated with
-- lib/validation, appear in the review queue and the audit log (actor = the person who started the import).

alter table public.organizations add column import_mapping jsonb not null default '{}'::jsonb;

create type public.import_status as enum ('uploaded', 'queued', 'processing', 'done', 'failed');

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 200),
  storage_path text not null check (storage_path like org_id::text || '/imports/%'),
  mapping jsonb not null default '{}'::jsonb,
  approve boolean not null default false,
  status public.import_status not null default 'uploaded',
  rows_total int not null default 0,
  rows_ok int not null default 0,
  rows_failed int not null default 0,
  error_report_path text check (error_report_path is null or error_report_path like org_id::text || '/imports/%'),
  error text,
  created_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index imports_org_idx on public.imports (org_id, created_at desc);

alter table public.records
  add column source text not null default 'document' check (source in ('document', 'import')),
  add column import_id uuid references public.imports (id) on delete set null;
create index records_import_idx on public.records (import_id) where import_id is not null;

create trigger prevent_org_change before update on public.imports for each row execute function public.prevent_org_change();
create trigger set_updated_at before update on public.imports for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.imports for each row execute function public.audit_row_change();

alter table public.imports enable row level security;
alter table public.imports force row level security;
create policy imports_select on public.imports for select using (public.is_org_member(org_id));
create policy imports_insert on public.imports for insert with check (
  public.has_org_role(org_id, array['owner', 'admin', 'reviewer', 'member'])
  and status = 'uploaded' and created_by = auth.uid()
  and rows_total = 0 and rows_ok = 0 and rows_failed = 0 and error_report_path is null
);
create policy imports_delete on public.imports for delete using (public.has_org_role(org_id, array['owner', 'admin']));
revoke insert on public.imports from authenticated, anon;
grant insert (org_id, file_name, storage_path) on public.imports to authenticated;

/**
 * Queue an uploaded import with its column mapping. Writers; approving rows on import needs owner/admin/reviewer.
 * The mapping is also saved as the org's default for the next file.
 */
create function public.start_import(p_import uuid, p_mapping jsonb, p_approve boolean) returns public.imports
language plpgsql security definer set search_path = '' as $$
declare
  v_import public.imports;
begin
  select * into v_import from public.imports where id = p_import for update;
  if v_import.id is null or not public.has_org_role(v_import.org_id, array['owner', 'admin', 'reviewer', 'member']) then
    raise exception 'import not found' using errcode = 'P0002';
  end if;
  if p_approve and not public.has_org_role(v_import.org_id, array['owner', 'admin', 'reviewer']) then
    raise exception 'only reviewers can approve on import' using errcode = '42501';
  end if;
  if v_import.status <> 'uploaded' then
    raise exception 'this import has already started' using errcode = '22023';
  end if;
  if jsonb_typeof(p_mapping) <> 'object' then
    raise exception 'invalid mapping' using errcode = '22023';
  end if;
  update public.imports set mapping = p_mapping, approve = p_approve, status = 'queued'
  where id = p_import returning * into v_import;
  update public.organizations set import_mapping = p_mapping where id = v_import.org_id;
  return v_import;
end;
$$;

/**
 * Worker: insert one chunk of validated rows as records of the import (needs_review; the worker validates and
 * finishes each one with finish_import_record). Audited as p_actor (the person who started the import).
 * p_rows: [{ supplier_name, supplier_tax_id, invoice_number, document_type, issue_date, due_date, currency,
 *            subtotal_cents, tax_cents, tax_rate, total_cents, category, entity_id }]. Returns the new ids in order.
 */
create function public.import_records(p_org uuid, p_import uuid, p_actor uuid, p_rows jsonb) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[] := '{}';
  v_row jsonb;
  v_id uuid;
  v_confidence jsonb;
begin
  if not exists (select 1 from public.imports where id = p_import and org_id = p_org and status = 'processing') then
    raise exception 'import is not processing' using errcode = '22023';
  end if;
  perform set_config('app.actor_id', p_actor::text, true);
  for v_row in select * from jsonb_array_elements(p_rows) loop
    -- Typed by a person: every provided field is fully confident.
    select coalesce(jsonb_object_agg(case when key = 'entity_id' then 'entity' else key end, 1), '{}'::jsonb)
    into v_confidence
    from jsonb_each(v_row) where value <> 'null'::jsonb;
    insert into public.records (
      org_id, source, import_id, entity_id, document_type, supplier_name, supplier_tax_id, invoice_number, issue_date,
      due_date, currency, subtotal_cents, tax_cents, tax_rate, total_cents, category, min_confidence, field_confidence
    ) values (
      p_org, 'import', p_import, (v_row ->> 'entity_id')::uuid, (v_row ->> 'document_type')::public.document_type,
      v_row ->> 'supplier_name', v_row ->> 'supplier_tax_id', v_row ->> 'invoice_number', (v_row ->> 'issue_date')::date,
      (v_row ->> 'due_date')::date, v_row ->> 'currency', (v_row ->> 'subtotal_cents')::bigint,
      (v_row ->> 'tax_cents')::bigint, (v_row ->> 'tax_rate')::numeric, (v_row ->> 'total_cents')::bigint,
      (v_row ->> 'category')::public.cost_category, 1, v_confidence
    ) returning id into v_id;
    v_ids := v_ids || v_id;
  end loop;
  return v_ids;
end;
$$;

/**
 * Worker: store an imported record's validation issues; with "approve on import" a record without issues is
 * approved by the importer (review action with a reason). Audited as p_actor.
 */
create function public.finish_import_record(p_org uuid, p_record uuid, p_issues jsonb, p_approve boolean, p_actor uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('app.actor_id', p_actor::text, true);
  if not exists (select 1 from public.records where id = p_record and org_id = p_org and source = 'import') then
    raise exception 'record not found' using errcode = 'P0002';
  end if;
  perform public.replace_record_issues(p_org, p_record, p_issues);
  if p_approve and jsonb_array_length(p_issues) = 0 then
    update public.records set status = 'approved', approved_by = p_actor, approved_at = now() where id = p_record;
    insert into public.review_actions (org_id, record_id, actor_id, action, reason)
    values (p_org, p_record, p_actor, 'approve', 'Approved on import (no issues found)');
  end if;
end;
$$;

revoke execute on function public.start_import from public, anon;
grant execute on function public.start_import to authenticated;
revoke execute on function public.import_records from public, anon, authenticated;
grant execute on function public.import_records to service_role;
revoke execute on function public.finish_import_record from public, anon, authenticated;
grant execute on function public.finish_import_record to service_role;

alter publication supabase_realtime add table public.imports;

update storage.buckets
set file_size_limit = 5242880, allowed_mime_types = array['text/csv', 'text/plain', 'application/vnd.ms-excel']
where id = 'imports';
