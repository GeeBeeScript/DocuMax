-- Phase 6 — Validation issues, review actions, review/approval functions, auto-approve setting.
--
-- | table             | select | writes                                                                           |
-- | ----------------- | ------ | -------------------------------------------------------------------------------- |
-- | validation_issues | member | worker (save_validation) and reviewers (review_record) — current issues per record |
-- | review_actions    | member | review_record / bulk_approve_clean / save_validation only; append-only           |
--
-- Records and line items are never updated directly by users: review_record() is the only path. It checks the
-- role, writes one review_actions row per changed field (before/after + reason), and the audit trigger on records /
-- line_items captures the same change with the actor.

alter table public.organizations add column auto_approve boolean not null default false;

create type public.issue_severity as enum ('error', 'warning');
create type public.review_action_type as enum ('approve', 'reject', 'correct', 'reopen');

create table public.validation_issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  record_id uuid not null references public.records (id) on delete cascade,
  code text not null check (code in (
    'duplicate_file', 'duplicate', 'missing_field', 'total_mismatch', 'lines_mismatch', 'line_math',
    'low_confidence', 'date_suspicious', 'no_entity'
  )),
  severity public.issue_severity not null,
  field text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index validation_issues_record_idx on public.validation_issues (record_id);
create index validation_issues_org_code_idx on public.validation_issues (org_id, code) where resolved_at is null;

create table public.review_actions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  record_id uuid not null references public.records (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null, -- null = system (auto-approve)
  action public.review_action_type not null,
  field text,
  before jsonb,
  after jsonb,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);
create index review_actions_record_idx on public.review_actions (record_id, created_at);
create index review_actions_org_idx on public.review_actions (org_id, created_at desc);

create function public.check_record_child_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.records r where r.id = new.record_id and r.org_id = new.org_id) then
    raise exception 'record belongs to another organization' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_record_child_org before insert or update on public.validation_issues
  for each row execute function public.check_record_child_org();
create trigger check_record_child_org before insert or update on public.review_actions
  for each row execute function public.check_record_child_org();
create trigger prevent_org_change before update on public.validation_issues for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.review_actions for each row execute function public.prevent_org_change();

alter table public.validation_issues enable row level security;
alter table public.validation_issues force row level security;
alter table public.review_actions enable row level security;
alter table public.review_actions force row level security;
create policy validation_issues_select on public.validation_issues for select using (public.is_org_member(org_id));
create policy review_actions_select on public.review_actions for select using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------------------------------------
/** Replace a record's current issues with p_issues: [{code, severity, field, message, details}]. */
create function public.replace_record_issues(p_org uuid, p_record uuid, p_issues jsonb) returns void
language sql security definer set search_path = '' as $$
  delete from public.validation_issues where record_id = p_record;
  insert into public.validation_issues (org_id, record_id, code, severity, field, message, details)
  select p_org, p_record, x.code, x.severity, x.field, x.message, coalesce(x.details, '{}'::jsonb)
  from jsonb_to_recordset(coalesce(p_issues, '[]'::jsonb))
    as x(code text, severity public.issue_severity, field text, message text, details jsonb);
$$;
revoke execute on function public.replace_record_issues from public, anon, authenticated;

/**
 * Lowest confidence over the record's required fields — mirrors lib/validation/required-fields.ts (supplier, issue
 * date, total, currency; plus invoice number for invoices). Keep the two in sync.
 */
create function public.record_min_confidence(p_field_confidence jsonb, p_document_type public.document_type)
returns numeric
language sql immutable set search_path = '' as $$
  select coalesce(min(coalesce((p_field_confidence ->> f)::numeric, 0)), 0)
  from unnest(array['supplier_name', 'issue_date', 'total_cents', 'currency']
              || case when p_document_type = 'invoice' then array['invoice_number'] else array[]::text[] end) f;
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Worker: stage 3 (validation) + stage 4 (routing)
-- ---------------------------------------------------------------------------------------------------------
/**
 * Stores the document's issues and routes it: validating → needs_review | ready. With p_record_status 'approved'
 * (clean + org auto-approve) the record is approved by the system actor. A record a human already decided on is
 * left alone (re-processing never overrides a decision). Returns the document, or null if not `validating`.
 */
create function public.save_validation(
  p_org uuid, p_document uuid, p_issues jsonb, p_record_status public.record_status,
  p_document_status public.document_status, p_actor uuid default null
) returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
  v_record public.records;
begin
  if p_document_status not in ('needs_review', 'ready') or p_record_status not in ('needs_review', 'approved') then
    raise exception 'invalid routing' using errcode = '22023';
  end if;
  perform set_config('app.actor_id', coalesce(p_actor, '00000000-0000-0000-0000-000000000000')::text, true);

  select * into v_doc from public.documents d
  where d.id = p_document and d.org_id = p_org and d.status = 'validating'
  for update;
  if v_doc.id is null then
    return null;
  end if;

  select * into v_record from public.records r where r.document_id = p_document for update;
  if v_record.id is not null and v_record.status = 'needs_review' then
    perform public.replace_record_issues(p_org, v_record.id, p_issues);
    if p_record_status = 'approved' then
      update public.records set status = 'approved', approved_by = null, approved_at = now() where id = v_record.id;
      insert into public.review_actions (org_id, record_id, actor_id, action, reason)
      values (p_org, v_record.id, null, 'approve', 'Auto-approved: no issues found');
    end if;
  end if;

  update public.documents set status = p_document_status, error = null where id = p_document returning * into v_doc;
  return v_doc;
end;
$$;
revoke execute on function public.save_validation from public, anon, authenticated;
grant execute on function public.save_validation to service_role;

-- ---------------------------------------------------------------------------------------------------------
-- Users: review (correct / approve / reject / reopen)
-- ---------------------------------------------------------------------------------------------------------
/**
 * The only way users change a record. Reviewer, admin or owner.
 * - p_fields: corrected record fields (subset of the editable columns below); each change → one 'correct'
 *   review_actions row (before/after) and confidence 1 for that field.
 * - p_lines: the full corrected line-item list, or null to leave lines untouched.
 * - p_issues: the record's issues after the correction (computed by lib/validation), or null to keep them.
 * - p_action: 'correct' (save only), 'approve', 'reject' (reason required) or 'reopen' (approved/rejected → review).
 * Approving while error-severity issues remain requires a reason.
 */
create function public.review_record(
  p_record uuid, p_action public.review_action_type, p_fields jsonb default null, p_lines jsonb default null,
  p_issues jsonb default null, p_reason text default null
) returns public.records
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.records;
  v_new public.records;
  v_actor uuid := auth.uid();
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_key text;
  v_conf_key text;
  v_old_lines jsonb;
  v_new_lines jsonb;
  v_editable text[] := array[
    'document_type', 'supplier_name', 'supplier_tax_id', 'invoice_number', 'issue_date', 'due_date', 'currency',
    'subtotal_cents', 'tax_cents', 'tax_rate', 'total_cents', 'category', 'entity_id'
  ];
begin
  select * into v_old from public.records r where r.id = p_record for update;
  if v_old.id is null or not public.has_org_role(v_old.org_id, array['owner', 'admin', 'reviewer']) then
    raise exception 'record not found' using errcode = 'P0002';
  end if;

  if p_action = 'reopen' then
    if v_old.status = 'needs_review' then
      raise exception 'record is already awaiting review' using errcode = '22023';
    end if;
  elsif v_old.status <> 'needs_review' then
    raise exception 'record was already %; reopen it first', v_old.status using errcode = '22023';
  end if;

  -- Field corrections.
  v_new := v_old;
  if p_fields is not null then
    for v_key in select jsonb_object_keys(p_fields) loop
      if not v_key = any (v_editable) then
        raise exception 'field % cannot be edited', v_key using errcode = '22023';
      end if;
    end loop;
    v_new := jsonb_populate_record(v_old, p_fields);
    for v_key in select unnest(v_editable) loop
      if p_fields ? v_key and (to_jsonb(v_new) -> v_key) is distinct from (to_jsonb(v_old) -> v_key) then
        insert into public.review_actions (org_id, record_id, actor_id, action, field, before, after, reason)
        values (v_old.org_id, p_record, v_actor, 'correct', v_key, to_jsonb(v_old) -> v_key, to_jsonb(v_new) -> v_key, v_reason);
        v_conf_key := case v_key when 'entity_id' then 'entity' else v_key end;
        v_new.field_confidence := v_new.field_confidence || jsonb_build_object(v_conf_key, 1);
      end if;
    end loop;
  end if;

  -- Line items (full replacement when provided and different).
  if p_lines is not null then
    select coalesce(jsonb_agg(jsonb_build_object('position', l.position, 'description', l.description,
             'quantity', l.quantity, 'unit_price_cents', l.unit_price_cents, 'amount_cents', l.amount_cents,
             'category', l.category) order by l.position), '[]'::jsonb)
      into v_old_lines from public.line_items l where l.record_id = p_record;
    select coalesce(jsonb_agg(jsonb_build_object('position', x.position, 'description', x.description,
             'quantity', x.quantity, 'unit_price_cents', x.unit_price_cents, 'amount_cents', x.amount_cents,
             'category', x.category) order by x.position), '[]'::jsonb)
      into v_new_lines
      from jsonb_to_recordset(p_lines) as x(position int, description text, quantity numeric, unit_price_cents bigint,
                                            amount_cents bigint, category public.cost_category);
    if v_new_lines is distinct from v_old_lines then
      insert into public.review_actions (org_id, record_id, actor_id, action, field, before, after, reason)
      values (v_old.org_id, p_record, v_actor, 'correct', 'line_items', v_old_lines, v_new_lines, v_reason);
      delete from public.line_items where record_id = p_record;
      insert into public.line_items (org_id, record_id, position, description, quantity, unit_price_cents, amount_cents, category, confidence)
      select v_old.org_id, p_record, x.position, x.description, x.quantity, x.unit_price_cents, x.amount_cents, x.category, 1
      from jsonb_to_recordset(p_lines) as x(position int, description text, quantity numeric, unit_price_cents bigint,
                                            amount_cents bigint, category public.cost_category);
    end if;
  end if;

  v_new.min_confidence := public.record_min_confidence(v_new.field_confidence, v_new.document_type);
  update public.records set
    document_type = v_new.document_type, supplier_name = v_new.supplier_name, supplier_tax_id = v_new.supplier_tax_id,
    invoice_number = v_new.invoice_number, issue_date = v_new.issue_date, due_date = v_new.due_date,
    currency = v_new.currency, subtotal_cents = v_new.subtotal_cents, tax_cents = v_new.tax_cents,
    tax_rate = v_new.tax_rate, total_cents = v_new.total_cents, category = v_new.category,
    entity_id = v_new.entity_id, field_confidence = v_new.field_confidence, min_confidence = v_new.min_confidence
  where id = p_record;
  if v_new.entity_id is distinct from v_old.entity_id and v_old.document_id is not null then
    update public.documents set entity_id = v_new.entity_id where id = v_old.document_id;
  end if;

  if p_issues is not null then
    perform public.replace_record_issues(v_old.org_id, p_record, p_issues);
  end if;

  -- Decision.
  if p_action = 'approve' then
    if v_reason is null and exists (
      select 1 from public.validation_issues i where i.record_id = p_record and i.severity = 'error' and i.resolved_at is null
    ) then
      raise exception 'approving a record with errors needs a reason' using errcode = '22023';
    end if;
    update public.records set status = 'approved', approved_by = v_actor, approved_at = now() where id = p_record;
    update public.validation_issues set resolved_at = now(), resolved_by = v_actor where record_id = p_record and resolved_at is null;
  elsif p_action = 'reject' then
    if v_reason is null then
      raise exception 'rejecting needs a reason' using errcode = '22023';
    end if;
    update public.records set status = 'rejected', approved_by = null, approved_at = null where id = p_record;
  elsif p_action = 'reopen' then
    update public.records set status = 'needs_review', approved_by = null, approved_at = null where id = p_record;
    update public.validation_issues set resolved_at = null, resolved_by = null where record_id = p_record;
  end if;

  if p_action <> 'correct' then
    insert into public.review_actions (org_id, record_id, actor_id, action, reason)
    values (v_old.org_id, p_record, v_actor, p_action, v_reason);
    if v_old.document_id is not null then
      update public.documents
      set status = case when p_action = 'reopen' then 'needs_review'::public.document_status else 'ready'::public.document_status end
      where id = v_old.document_id and status in ('needs_review', 'ready');
    end if;
  end if;

  select * into v_new from public.records where id = p_record;
  return v_new;
end;
$$;

/**
 * Approve every listed record that is awaiting review and has no issues at all. Records with any issue are
 * skipped (they need a look). Returns how many were approved.
 */
create function public.bulk_approve_clean(p_records uuid[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_count int := 0;
  v_record public.records;
begin
  for v_record in
    select r.* from public.records r
    where r.id = any (p_records) and r.status = 'needs_review'
      and public.has_org_role(r.org_id, array['owner', 'admin', 'reviewer'])
      and not exists (select 1 from public.validation_issues i where i.record_id = r.id and i.resolved_at is null)
    for update
  loop
    update public.records set status = 'approved', approved_by = v_actor, approved_at = now() where id = v_record.id;
    insert into public.review_actions (org_id, record_id, actor_id, action, reason)
    values (v_record.org_id, v_record.id, v_actor, 'approve', 'Bulk approval (no issues)');
    if v_record.document_id is not null then
      update public.documents set status = 'ready' where id = v_record.document_id and status in ('needs_review', 'ready');
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.review_record from public, anon;
revoke execute on function public.bulk_approve_clean from public, anon;
grant execute on function public.review_record to authenticated;
grant execute on function public.bulk_approve_clean to authenticated;

-- Live review queue counts.
alter publication supabase_realtime add table public.records;
