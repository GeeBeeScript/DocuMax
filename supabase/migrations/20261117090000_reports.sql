-- Phase 8 — PDF reports: reports, report batches, branding footer, tighter storage rules.
--
-- | table          | select | writes                                                                        |
-- | -------------- | ------ | ----------------------------------------------------------------------------- |
-- | reports        | member | create_report / create_statement_batch (owner/admin/reviewer); worker updates |
-- |                |        | status (service role); owners/admins may delete                              |
-- | report_batches | member | create_statement_batch; worker updates progress (report_batch_progress)       |
--
-- Templates are code (pdf/templates); per-org look comes from branding (logo, brand colour, footer) — ADR-021.

alter table public.organizations
  add column footer_text text check (footer_text is null or char_length(footer_text) <= 200);

create type public.report_kind as enum ('statement', 'summary', 'quote');
create type public.report_status as enum ('queued', 'rendering', 'ready', 'failed');
create type public.batch_status as enum ('running', 'zipping', 'ready', 'failed');

create table public.report_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind public.report_kind not null default 'statement',
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  status public.batch_status not null default 'running',
  total int not null default 0,
  completed int not null default 0,
  failed int not null default 0,
  zip_path text check (zip_path is null or zip_path like org_id::text || '/batches/%'),
  error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index report_batches_org_idx on public.report_batches (org_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind public.report_kind not null,
  entity_id uuid references public.entities (id) on delete set null,
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  -- Quote options etc. ({ number, markupBp, taxRateBp, validUntil, notes } for quotes).
  params jsonb not null default '{}'::jsonb,
  status public.report_status not null default 'queued',
  file_name text not null check (char_length(file_name) between 1 and 200),
  storage_path text check (storage_path is null or storage_path like org_id::text || '/reports/%'),
  page_count int,
  byte_size int,
  error text,
  attempts int not null default 0,
  batch_id uuid references public.report_batches (id) on delete cascade,
  generated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'summary' or entity_id is null)
);
create index reports_org_idx on public.reports (org_id, created_at desc);
create index reports_batch_idx on public.reports (batch_id) where batch_id is not null;

create function public.check_report_org() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.entity_id is not null and not exists (select 1 from public.entities e where e.id = new.entity_id and e.org_id = new.org_id)
     or new.batch_id is not null and not exists (select 1 from public.report_batches b where b.id = new.batch_id and b.org_id = new.org_id) then
    raise exception 'related row belongs to another organization' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger check_report_org before insert or update on public.reports for each row execute function public.check_report_org();
create trigger prevent_org_change before update on public.reports for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.report_batches for each row execute function public.prevent_org_change();
create trigger set_updated_at before update on public.reports for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_batches for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.reports for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.report_batches for each row execute function public.audit_row_change();

alter table public.reports enable row level security;
alter table public.reports force row level security;
alter table public.report_batches enable row level security;
alter table public.report_batches force row level security;
create policy reports_select on public.reports for select using (public.is_org_member(org_id));
create policy reports_delete on public.reports for delete using (public.has_org_role(org_id, array['owner', 'admin']));
create policy report_batches_select on public.report_batches for select using (public.is_org_member(org_id));
create policy report_batches_delete on public.report_batches for delete using (public.has_org_role(org_id, array['owner', 'admin']));

/** Next quote number for an org: Q-YYYY-NNNN (per calendar year; serialized per org). */
create function public.next_quote_number(p_org uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_year text := to_char(now(), 'YYYY');
  v_next int;
begin
  perform pg_advisory_xact_lock(hashtext('quote-number:' || p_org::text));
  select coalesce(max(substring(params ->> 'number' from '^Q-' || v_year || '-(\d+)$')::int), 0) + 1 into v_next
  from public.reports where org_id = p_org and kind = 'quote';
  return 'Q-' || v_year || '-' || lpad(v_next::text, 4, '0');
end;
$$;

/**
 * Queue one report. Owners/admins/reviewers. Statements and quotes need an entity of the org; summaries don't take
 * one. For quotes, params gets the next quote number and "{number}" in p_file_name is replaced with it. Returns the
 * new row; the caller enqueues `render-report`.
 */
create function public.create_report(
  p_org uuid, p_kind public.report_kind, p_entity uuid, p_start date, p_end date, p_params jsonb, p_file_name text
) returns public.reports
language plpgsql security definer set search_path = '' as $$
declare
  v_report public.reports;
  v_params jsonb := coalesce(p_params, '{}'::jsonb);
begin
  if not public.has_org_role(p_org, array['owner', 'admin', 'reviewer']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if (p_kind = 'summary') <> (p_entity is null) then
    raise exception 'statements and quotes need a property or job; summaries don''t' using errcode = '22023';
  end if;
  if p_entity is not null and not exists (select 1 from public.entities where id = p_entity and org_id = p_org) then
    raise exception 'unknown property or job' using errcode = '22023';
  end if;
  if p_end < p_start or p_end - p_start > 366 * 5 then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  if p_kind = 'quote' then
    v_params := v_params || jsonb_build_object('number', public.next_quote_number(p_org));
  end if;
  insert into public.reports (org_id, kind, entity_id, period_start, period_end, params, file_name, generated_by)
  values (p_org, p_kind, p_entity, p_start, p_end, v_params,
          replace(p_file_name, '{number}', coalesce(v_params ->> 'number', '')), auth.uid())
  returning * into v_report;
  return v_report;
end;
$$;

/**
 * Queue a statement for every active entity of the org for a period, as one batch. Returns the batch; the caller
 * enqueues `render-report` for each of its reports (select id from reports where batch_id = …).
 * p_file_names: { "<entity_id>": "<file name>" } — names are built in the app (lib, tested).
 */
create function public.create_statement_batch(p_org uuid, p_start date, p_end date, p_file_names jsonb)
returns public.report_batches
language plpgsql security definer set search_path = '' as $$
declare
  v_batch public.report_batches;
  v_count int;
begin
  if not public.has_org_role(p_org, array['owner', 'admin', 'reviewer']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_end < p_start or p_end - p_start > 366 * 5 then
    raise exception 'invalid period' using errcode = '22023';
  end if;
  insert into public.report_batches (org_id, kind, period_start, period_end, created_by)
  values (p_org, 'statement', p_start, p_end, auth.uid())
  returning * into v_batch;

  insert into public.reports (org_id, kind, entity_id, period_start, period_end, file_name, batch_id, generated_by)
  select p_org, 'statement', e.id, p_start, p_end,
         coalesce(p_file_names ->> e.id::text, 'Statement ' || e.name || '.pdf'), v_batch.id, auth.uid()
  from public.entities e
  where e.org_id = p_org and e.status = 'active';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'there are no active properties or jobs' using errcode = '22023';
  end if;

  update public.report_batches set total = v_count where id = v_batch.id returning * into v_batch;
  return v_batch;
end;
$$;

/**
 * Worker: recount a batch's finished reports. Returns true exactly once — when the last report finishes and the
 * batch moves to `zipping` (the caller then enqueues `batch-zip`).
 */
create function public.report_batch_progress(p_org uuid, p_batch uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_batch public.report_batches;
  v_ready int;
  v_failed int;
begin
  select * into v_batch from public.report_batches where id = p_batch and org_id = p_org for update;
  if v_batch.id is null then
    return false;
  end if;
  select count(*) filter (where status = 'ready'), count(*) filter (where status = 'failed')
  into v_ready, v_failed
  from public.reports where batch_id = p_batch;
  update public.report_batches
  set completed = v_ready,
      failed = v_failed,
      status = case when v_batch.status = 'running' and v_ready + v_failed >= v_batch.total then 'zipping'::public.batch_status
                    else v_batch.status end
  where id = p_batch;
  return v_batch.status = 'running' and v_ready + v_failed >= v_batch.total;
end;
$$;

revoke execute on function public.next_quote_number from public, anon, authenticated;
revoke execute on function public.create_report from public, anon;
grant execute on function public.create_report to authenticated;
revoke execute on function public.create_statement_batch from public, anon;
grant execute on function public.create_statement_batch to authenticated;
revoke execute on function public.report_batch_progress from public, anon, authenticated;
grant execute on function public.report_batch_progress to service_role;

-- Live progress on the reports page.
alter publication supabase_realtime add table public.reports;
alter publication supabase_realtime add table public.report_batches;

-- ---------------------------------------------------------------------------------------------------------
-- Storage: reports are written only by the worker (service role); branding by owners/admins; limits.
-- ---------------------------------------------------------------------------------------------------------
drop policy tenant_objects_insert on storage.objects;
drop policy tenant_objects_update on storage.objects;
create policy tenant_objects_insert on storage.objects for insert to authenticated with check (
  (bucket_id in ('documents', 'imports')
   and public.has_org_role(public.storage_org_id(name), array['owner', 'admin', 'reviewer', 'member']))
  or (bucket_id = 'branding' and public.has_org_role(public.storage_org_id(name), array['owner', 'admin']))
);
create policy tenant_objects_update on storage.objects for update to authenticated
  using ((bucket_id in ('documents', 'imports')
          and public.has_org_role(public.storage_org_id(name), array['owner', 'admin', 'reviewer', 'member']))
         or (bucket_id = 'branding' and public.has_org_role(public.storage_org_id(name), array['owner', 'admin'])))
  with check ((bucket_id in ('documents', 'imports')
               and public.has_org_role(public.storage_org_id(name), array['owner', 'admin', 'reviewer', 'member']))
              or (bucket_id = 'branding' and public.has_org_role(public.storage_org_id(name), array['owner', 'admin'])));

update storage.buckets
set file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
where id = 'branding';
update storage.buckets
set file_size_limit = 104857600, allowed_mime_types = array['application/pdf', 'application/zip']
where id = 'reports';
