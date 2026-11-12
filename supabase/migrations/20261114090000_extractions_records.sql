-- Phase 5 — AI extraction results: extractions (raw model output + metrics), records (checked fields, money in
-- cents) and line_items.
--
-- | table       | select | insert / update / delete                                                       |
-- | ----------- | ------ | ------------------------------------------------------------------------------ |
-- | extractions | member | worker only, via save_extraction() (service role)                              |
-- | records     | member | worker only for now; review actions (approve / reject / correct) land in Phase 6 |
-- | line_items  | member | as records                                                                     |
--
-- records and line_items are audited (✎ in DATA_MODEL); extractions are an append-only log (one row per attempt
-- that produced a result), not audited.

create type public.record_status as enum ('needs_review', 'approved', 'rejected');
create type public.document_type as enum ('invoice', 'receipt', 'credit_note', 'quote', 'statement', 'other');
create type public.cost_category as enum (
  'repairs_maintenance', 'materials', 'labor_subcontract', 'utilities', 'cleaning', 'landscaping', 'insurance',
  'taxes_fees', 'professional_services', 'equipment_rental', 'travel_fuel', 'office_admin', 'other'
);

-- ---------------------------------------------------------------------------------------------------------
-- extractions
-- ---------------------------------------------------------------------------------------------------------
create table public.extractions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  provider text not null,
  model text not null,
  schema_version int not null,
  raw jsonb not null,
  fields jsonb not null,
  attempts int not null check (attempts between 1 and 10),
  latency_ms int not null check (latency_ms >= 0),
  tokens_in int not null default 0 check (tokens_in >= 0),
  tokens_out int not null default 0 check (tokens_out >= 0),
  created_at timestamptz not null default now()
);
create index extractions_document_idx on public.extractions (document_id, created_at desc);
create index extractions_org_idx on public.extractions (org_id, created_at desc);

-- ---------------------------------------------------------------------------------------------------------
-- records (one per document; imports in Phase 9 create records without a document)
-- ---------------------------------------------------------------------------------------------------------
create table public.records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  document_id uuid unique references public.documents (id) on delete cascade,
  extraction_id uuid references public.extractions (id) on delete set null,
  entity_id uuid references public.entities (id) on delete set null,
  document_type public.document_type,
  supplier_name text,
  supplier_tax_id text,
  invoice_number text,
  issue_date date,
  due_date date,
  currency char(3) check (currency ~ '^[A-Z]{3}$'),
  subtotal_cents bigint,
  tax_cents bigint,
  tax_rate numeric(7, 4),
  total_cents bigint,
  category public.cost_category,
  entity_hint text,
  status public.record_status not null default 'needs_review',
  min_confidence numeric(4, 3) not null check (min_confidence between 0 and 1),
  field_confidence jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index records_org_status_idx on public.records (org_id, status, created_at desc);
create index records_org_supplier_idx on public.records (org_id, lower(supplier_name));
create index records_entity_idx on public.records (entity_id);

create table public.line_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  record_id uuid not null references public.records (id) on delete cascade,
  position int not null check (position >= 1),
  description text,
  quantity numeric(14, 4),
  unit_price_cents bigint,
  amount_cents bigint,
  category public.cost_category,
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_id, position)
);
create index line_items_org_idx on public.line_items (org_id);

/** Children must belong to the same org as their parent (record ↔ document/entity/extraction, line ↔ record). */
create function public.check_record_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.document_id is not null and not exists (select 1 from public.documents d where d.id = new.document_id and d.org_id = new.org_id)
     or new.entity_id is not null and not exists (select 1 from public.entities e where e.id = new.entity_id and e.org_id = new.org_id)
     or new.extraction_id is not null and not exists (select 1 from public.extractions x where x.id = new.extraction_id and x.org_id = new.org_id) then
    raise exception 'related row belongs to another organization' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function public.check_line_item_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.records r where r.id = new.record_id and r.org_id = new.org_id) then
    raise exception 'record belongs to another organization' using errcode = '42501';
  end if;
  return new;
end;
$$;

create function public.check_extraction_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.documents d where d.id = new.document_id and d.org_id = new.org_id) then
    raise exception 'document belongs to another organization' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_extraction_org before insert or update on public.extractions for each row execute function public.check_extraction_org();
create trigger check_record_org before insert or update on public.records for each row execute function public.check_record_org();
create trigger check_line_item_org before insert or update on public.line_items for each row execute function public.check_line_item_org();

create trigger set_updated_at before update on public.records for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.line_items for each row execute function public.set_updated_at();
create trigger prevent_org_change before update on public.extractions for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.records for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.line_items for each row execute function public.prevent_org_change();
create trigger audit after insert or update or delete on public.records for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.line_items for each row execute function public.audit_row_change();

alter table public.extractions enable row level security;
alter table public.extractions force row level security;
alter table public.records enable row level security;
alter table public.records force row level security;
alter table public.line_items enable row level security;
alter table public.line_items force row level security;

create policy extractions_select on public.extractions for select using (public.is_org_member(org_id));
create policy records_select on public.records for select using (public.is_org_member(org_id));
create policy line_items_select on public.line_items for select using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------------------------------------
-- save_extraction(): worker-only, atomic, status-checked
-- ---------------------------------------------------------------------------------------------------------
/**
 * Stores one extraction and (re)writes the document's record + line items, then moves the document
 * analyzing → validating. Returns the document, or null if it isn't `analyzing` for this org (stale/duplicate
 * job — nothing is written). An already approved/rejected record is left untouched (re-processing never
 * overrides a human decision); the extraction is still logged.
 * Also assigns the matched entity to the document when the user hadn't assigned one.
 */
create function public.save_extraction(
  p_org uuid, p_document uuid, p_extraction jsonb, p_record jsonb, p_lines jsonb, p_actor uuid default null
) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
  v_extraction_id uuid;
  v_record public.records;
begin
  perform set_config('app.actor_id', coalesce(p_actor, '00000000-0000-0000-0000-000000000000')::text, true);

  select * into v_doc from public.documents d
  where d.id = p_document and d.org_id = p_org and d.status = 'analyzing'
  for update;
  if v_doc.id is null then
    return null;
  end if;

  insert into public.extractions (org_id, document_id, provider, model, schema_version, raw, fields, attempts, latency_ms, tokens_in, tokens_out)
  values (p_org, p_document, p_extraction ->> 'provider', p_extraction ->> 'model', (p_extraction ->> 'schema_version')::int,
          p_extraction -> 'raw', p_extraction -> 'fields', (p_extraction ->> 'attempts')::int,
          (p_extraction ->> 'latency_ms')::int, (p_extraction ->> 'tokens_in')::int, (p_extraction ->> 'tokens_out')::int)
  returning id into v_extraction_id;

  select * into v_record from public.records r where r.document_id = p_document for update;
  if v_record.id is null or v_record.status = 'needs_review' then
    insert into public.records (
      org_id, document_id, extraction_id, entity_id, document_type, supplier_name, supplier_tax_id, invoice_number,
      issue_date, due_date, currency, subtotal_cents, tax_cents, tax_rate, total_cents, category, entity_hint,
      status, min_confidence, field_confidence
    )
    select p_org, p_document, v_extraction_id, x.entity_id, x.document_type, x.supplier_name, x.supplier_tax_id,
           x.invoice_number, x.issue_date, x.due_date, x.currency, x.subtotal_cents, x.tax_cents, x.tax_rate,
           x.total_cents, x.category, x.entity_hint, 'needs_review', x.min_confidence, coalesce(x.field_confidence, '{}')
    from jsonb_to_record(p_record) as x(
      entity_id uuid, document_type public.document_type, supplier_name text, supplier_tax_id text, invoice_number text,
      issue_date date, due_date date, currency text, subtotal_cents bigint, tax_cents bigint, tax_rate numeric,
      total_cents bigint, category public.cost_category, entity_hint text, min_confidence numeric, field_confidence jsonb
    )
    on conflict (document_id) do update set
      extraction_id = excluded.extraction_id, entity_id = excluded.entity_id, document_type = excluded.document_type,
      supplier_name = excluded.supplier_name, supplier_tax_id = excluded.supplier_tax_id,
      invoice_number = excluded.invoice_number, issue_date = excluded.issue_date, due_date = excluded.due_date,
      currency = excluded.currency, subtotal_cents = excluded.subtotal_cents, tax_cents = excluded.tax_cents,
      tax_rate = excluded.tax_rate, total_cents = excluded.total_cents, category = excluded.category,
      entity_hint = excluded.entity_hint, min_confidence = excluded.min_confidence,
      field_confidence = excluded.field_confidence
    returning * into v_record;

    delete from public.line_items where record_id = v_record.id;
    insert into public.line_items (org_id, record_id, position, description, quantity, unit_price_cents, amount_cents, category, confidence)
    select p_org, v_record.id, l.position, l.description, l.quantity, l.unit_price_cents, l.amount_cents, l.category, l.confidence
    from jsonb_to_recordset(p_lines) as l(
      position int, description text, quantity numeric, unit_price_cents bigint, amount_cents bigint,
      category public.cost_category, confidence numeric
    );
  end if;

  update public.documents d
  set status = 'validating', entity_id = coalesce(d.entity_id, v_record.entity_id), error = null
  where d.id = p_document
  returning * into v_doc;
  return v_doc;
end;
$$;

revoke execute on function public.save_extraction from public, anon, authenticated;
grant execute on function public.save_extraction to service_role;
