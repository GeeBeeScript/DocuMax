-- Phase 7 — Allocations (splitting a record or a line across entities) and the org time zone.
--
-- | table       | select | writes                                                     |
-- | ----------- | ------ | ---------------------------------------------------------- |
-- | allocations | member | set_allocations() only (owner / admin / reviewer); audited |
--
-- Semantics (computed in lib/calc/postings.ts, docs/DATA_MODEL.md → Allocations):
--   * no allocation → the record counts 100% to records.entity_id;
--   * record-level rows (line_item_id null) split the record total by percent (basis points, total 10 000) or by
--     fixed amounts (the remainder stays with records.entity_id);
--   * line-level rows split one line the same way;
--   * a record uses record-level OR line-level rows, never both (set_allocations replaces the other kind).
-- Replacing a record's line items (review corrections) removes that record's line-level rows (cascade).

alter table public.organizations
  add column timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64);

create type public.allocation_method as enum ('percent', 'amount');

create table public.allocations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  record_id uuid not null references public.records (id) on delete cascade,
  line_item_id uuid references public.line_items (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete restrict,
  method public.allocation_method not null,
  percent_bp int check (percent_bp between 0 and 10000),
  amount_cents bigint,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (method = 'percent' and percent_bp is not null and amount_cents is null)
    or (method = 'amount' and amount_cents is not null and percent_bp is null)
  ),
  unique nulls not distinct (record_id, line_item_id, entity_id)
);
create index allocations_org_entity_idx on public.allocations (org_id, entity_id);
create index allocations_record_idx on public.allocations (record_id);

create function public.check_allocation_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.records r where r.id = new.record_id and r.org_id = new.org_id)
     or not exists (select 1 from public.entities e where e.id = new.entity_id and e.org_id = new.org_id)
     or new.line_item_id is not null and not exists (
       select 1 from public.line_items l where l.id = new.line_item_id and l.record_id = new.record_id) then
    raise exception 'related row belongs to another organization or record' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_allocation_org before insert or update on public.allocations
  for each row execute function public.check_allocation_org();
create trigger prevent_org_change before update on public.allocations for each row execute function public.prevent_org_change();
create trigger set_updated_at before update on public.allocations for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.allocations for each row execute function public.audit_row_change();

alter table public.allocations enable row level security;
alter table public.allocations force row level security;
create policy allocations_select on public.allocations for select using (public.is_org_member(org_id));
-- No insert/update/delete policies: set_allocations() is the only write path.

/**
 * Replace the allocations of a record (p_line_item null) or of one of its lines.
 * p_splits: [{ "entity_id": uuid, "percent_bp": int } …] for 'percent', [{ "entity_id", "amount_cents" } …] for
 * 'amount'; an empty array clears the split (100% back to the record's entity). Validates like lib/calc/allocate.ts:
 * percents total exactly 10 000; amounts share the source's sign and don't exceed it. Rejected records can't be split.
 * Returns the number of rows written.
 */
create function public.set_allocations(
  p_record uuid, p_line_item uuid, p_method public.allocation_method, p_splits jsonb
) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_record public.records;
  v_source bigint;
  v_split jsonb;
  v_entity uuid;
  v_value bigint;
  v_sum bigint := 0;
  v_count int := 0;
begin
  select * into v_record from public.records where id = p_record for update;
  if v_record.id is null or not public.has_org_role(v_record.org_id, array['owner', 'admin', 'reviewer']) then
    raise exception 'record not found' using errcode = 'P0002';
  end if;
  if v_record.status = 'rejected' then
    raise exception 'a rejected record can''t be split' using errcode = '22023';
  end if;
  if jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) > 50 then
    raise exception 'splits must be a list of at most 50 entries' using errcode = '22023';
  end if;

  if p_line_item is null then
    v_source := v_record.total_cents;
  else
    select amount_cents into v_source from public.line_items where id = p_line_item and record_id = p_record;
    if not found then
      raise exception 'line not found' using errcode = 'P0002';
    end if;
  end if;
  if v_source is null and jsonb_array_length(p_splits) > 0 then
    raise exception 'set the amount before splitting it' using errcode = '22023';
  end if;

  -- Validate every entry before writing anything.
  for v_split in select * from jsonb_array_elements(p_splits) loop
    v_entity := (v_split ->> 'entity_id')::uuid;
    if not exists (select 1 from public.entities e where e.id = v_entity and e.org_id = v_record.org_id) then
      raise exception 'unknown entity' using errcode = '22023';
    end if;
    if p_method = 'percent' then
      v_value := (v_split ->> 'percent_bp')::bigint;
      if v_value is null or v_value < 0 or v_value > 10000 then
        raise exception 'each percentage must be between 0%% and 100%%' using errcode = '22023';
      end if;
    else
      v_value := (v_split ->> 'amount_cents')::bigint;
      if v_value is null or (v_value <> 0 and sign(v_value) <> sign(v_source)) then
        raise exception 'amounts must have the same sign as the total' using errcode = '22023';
      end if;
    end if;
    v_sum := v_sum + v_value;
  end loop;
  if (select count(distinct value ->> 'entity_id') from jsonb_array_elements(p_splits)) <> jsonb_array_length(p_splits) then
    raise exception 'each entity can appear only once' using errcode = '22023';
  end if;
  if jsonb_array_length(p_splits) > 0 then
    if p_method = 'percent' and v_sum <> 10000 then
      raise exception 'percentages must add up to 100%%' using errcode = '22023';
    elsif p_method = 'amount' and abs(v_sum) > abs(v_source) then
      raise exception 'the amounts add up to more than the total' using errcode = '22023';
    end if;
  end if;

  -- Replace: this scope, plus the other kind (record-level and line-level splits are exclusive).
  if p_line_item is null then
    delete from public.allocations where record_id = p_record;
  else
    delete from public.allocations
    where record_id = p_record and (line_item_id is null or line_item_id = p_line_item);
  end if;

  for v_split in select * from jsonb_array_elements(p_splits) loop
    insert into public.allocations (org_id, record_id, line_item_id, entity_id, method, percent_bp, amount_cents, created_by)
    values (
      v_record.org_id, p_record, p_line_item, (v_split ->> 'entity_id')::uuid, p_method,
      case when p_method = 'percent' then (v_split ->> 'percent_bp')::int end,
      case when p_method = 'amount' then (v_split ->> 'amount_cents')::bigint end,
      auth.uid()
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.set_allocations from public, anon;
grant execute on function public.set_allocations to authenticated, service_role;
revoke execute on function public.check_allocation_org from public, anon, authenticated;
