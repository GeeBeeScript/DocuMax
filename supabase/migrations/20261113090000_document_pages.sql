-- Phase 4 — Per-page extracted text (stage 1 of the document pipeline).
--
-- | table          | select | insert / update / delete                              |
-- | -------------- | ------ | ----------------------------------------------------- |
-- | document_pages | member | worker only, via save_document_pages() (service role) |
--
-- Rows cascade with their document. Not audited row by row (derived data); the document's own status change to
-- `analyzing` is audited and attributed to the worker.

create type public.page_source as enum ('text_layer', 'ocr');

create table public.document_pages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  page_no int not null check (page_no between 1 and 1000),
  text text not null default '',
  source public.page_source not null,
  ocr_confidence numeric(4, 3) check (ocr_confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (document_id, page_no),
  -- OCR pages carry a confidence; text-layer pages don't.
  constraint document_pages_confidence_check check ((source = 'ocr') = (ocr_confidence is not null))
);
create index document_pages_org_idx on public.document_pages (org_id);

/** A page's org_id must be its document's org_id. */
create function public.check_page_document_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.documents d where d.id = new.document_id and d.org_id = new.org_id) then
    raise exception 'document belongs to another organization' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_page_document_org before insert or update on public.document_pages
  for each row execute function public.check_page_document_org();
create trigger prevent_org_change before update on public.document_pages
  for each row execute function public.prevent_org_change();

alter table public.document_pages enable row level security;
alter table public.document_pages force row level security;
create policy document_pages_select on public.document_pages for select using (public.is_org_member(org_id));

/**
 * Worker-only: replace the document's pages and move it extracting → analyzing in one transaction. Returns the
 * document, or null when it isn't in `extracting` for this org (stale/duplicate job — nothing is written).
 * p_pages: [{ "page_no": 1, "text": "…", "source": "ocr", "ocr_confidence": 0.91 }, …]
 */
create function public.save_document_pages(
  p_org uuid, p_document uuid, p_page_count int, p_pages jsonb, p_sha256 text default null, p_actor uuid default null
) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  perform set_config('app.actor_id', coalesce(p_actor, '00000000-0000-0000-0000-000000000000')::text, true);

  select * into v_doc from public.documents d
  where d.id = p_document and d.org_id = p_org and d.status = 'extracting'
  for update;
  if v_doc.id is null then
    return null;
  end if;

  delete from public.document_pages where document_id = p_document;
  insert into public.document_pages (org_id, document_id, page_no, text, source, ocr_confidence)
  select p_org, p_document, x.page_no, coalesce(x.text, ''), x.source, x.ocr_confidence
  from jsonb_to_recordset(p_pages) as x(page_no int, text text, source public.page_source, ocr_confidence numeric);

  update public.documents
  set status = 'analyzing', page_count = p_page_count, sha256 = coalesce(sha256, p_sha256), error = null
  where id = p_document
  returning * into v_doc;
  return v_doc;
end;
$$;

revoke execute on function public.save_document_pages from public, anon, authenticated;
grant execute on function public.save_document_pages to service_role;
