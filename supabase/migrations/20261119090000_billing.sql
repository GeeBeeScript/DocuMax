-- Phase 10 — Billing (Stripe) and usage limits.
--
-- | table          | select           | writes                                                              |
-- | -------------- | ---------------- | ------------------------------------------------------------------- |
-- | subscriptions  | member           | Stripe webhook (service role); set_stripe_customer() for owners     |
-- | usage_counters | member           | consume_document_quota / release_document_quota (security definer) |
-- | plan_limits    | everyone (authd) | migrations only — mirrors lib/billing/plans.ts (a test keeps them equal) |
-- | stripe_events  | nobody           | webhook (service role) — idempotency                                |
--
-- The effective plan is the subscription's plan while Stripe says it is active/trialing/past_due, else "free".
-- Usage is counted per calendar month in the org's time zone; consume_document_quota is atomic (row lock via
-- upsert), so concurrent uploads can never exceed the cap.

create table public.plan_limits (
  plan text primary key,
  documents_per_month int check (documents_per_month is null or documents_per_month >= 0),
  seats int check (seats is null or seats >= 1)
);
insert into public.plan_limits (plan, documents_per_month, seats) values
  ('free', 25, 1), ('pro', 500, 5), ('business', 2500, 20), ('enterprise', null, null);
alter table public.plan_limits enable row level security;
alter table public.plan_limits force row level security;
create policy plan_limits_select on public.plan_limits for select to authenticated using (true);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null unique references public.organizations (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan text not null default 'free' references public.plan_limits (plan),
  billing_interval text check (billing_interval in ('monthly', 'yearly')),
  status text not null default 'none',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  payment_failed_at timestamptz,
  -- Stripe event time of the last applied change (events can arrive out of order).
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  period_start date not null,
  documents_used int not null default 0 check (documents_used >= 0),
  updated_at timestamptz not null default now(),
  unique (org_id, period_start)
);

create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

create trigger prevent_org_change before update on public.subscriptions for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.usage_counters for each row execute function public.prevent_org_change();
create trigger set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.usage_counters for each row execute function public.set_updated_at();
create trigger audit after insert or update or delete on public.subscriptions for each row execute function public.audit_row_change();

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
alter table public.usage_counters enable row level security;
alter table public.usage_counters force row level security;
alter table public.stripe_events enable row level security;
alter table public.stripe_events force row level security; -- no policies: service role only
create policy subscriptions_select on public.subscriptions for select using (public.is_org_member(org_id));
create policy usage_counters_select on public.usage_counters for select using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------------------------------------
-- Plan + usage helpers
-- ---------------------------------------------------------------------------------------------------------
/** The plan an org is on right now. */
create function public.org_plan(p_org uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select s.plan from public.subscriptions s
     where s.org_id = p_org and s.status in ('active', 'trialing', 'past_due')),
    'free');
$$;

/** First day of the org's current month, in its time zone. */
create function public.org_usage_period(p_org uuid) returns date
language sql stable security definer set search_path = '' as $$
  select date_trunc('month', now() at time zone coalesce(
    (select o.timezone from public.organizations o where o.id = p_org), 'UTC'))::date;
$$;

/**
 * Count p_count documents against this month's cap. Raises 'quota_exceeded' (P0001, hint = remaining) when it
 * would go over. Writers only. The upsert's row lock serializes concurrent callers.
 */
create function public.consume_document_quota(p_org uuid, p_count int default 1) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_cap int;
  v_period date := public.org_usage_period(p_org);
  v_used int;
begin
  if not public.has_org_role(p_org, array['owner', 'admin', 'reviewer', 'member']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_count < 1 then
    raise exception 'invalid count' using errcode = '22023';
  end if;
  select documents_per_month into v_cap from public.plan_limits where plan = public.org_plan(p_org);

  insert into public.usage_counters as u (org_id, period_start, documents_used)
  select p_org, v_period, p_count
  where v_cap is null or p_count <= v_cap
  on conflict (org_id, period_start) do update
    set documents_used = u.documents_used + excluded.documents_used
    where v_cap is null or u.documents_used + excluded.documents_used <= v_cap
  returning documents_used into v_used;

  if v_used is null then
    select documents_used into v_used from public.usage_counters where org_id = p_org and period_start = v_period;
    raise exception 'quota_exceeded' using errcode = 'P0001',
      hint = greatest(coalesce(v_cap, 0) - coalesce(v_used, 0), 0)::text;
  end if;
  return v_used;
end;
$$;

/** Give back quota for documents that were never uploaded (never below zero). Internal / service role. */
create function public.release_document_quota(p_org uuid, p_count int default 1, p_period date default null)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.usage_counters
  set documents_used = greatest(documents_used - p_count, 0)
  where org_id = p_org and period_start = coalesce(p_period, public.org_usage_period(p_org));
end;
$$;

/** Plan, this month's usage and seats, for the app shell and billing page (members). */
create function public.org_usage(p_org uuid)
returns table (plan text, documents_used int, documents_cap int, seats_used int, seats_cap int, period_start date)
language sql stable security definer set search_path = '' as $$
  select p.plan,
         coalesce((select u.documents_used from public.usage_counters u
                   where u.org_id = p_org and u.period_start = public.org_usage_period(p_org)), 0),
         l.documents_per_month,
         ((select count(*) from public.memberships m where m.org_id = p_org)
          + (select count(*) from public.invites i where i.org_id = p_org and i.accepted_at is null and i.expires_at > now()))::int,
         l.seats,
         public.org_usage_period(p_org)
  from (select public.org_plan(p_org) as plan) p
  join public.plan_limits l on l.plan = p.plan
  where public.is_org_member(p_org);
$$;

/** Cancel an upload that never completed: removes the pending document and gives its quota back. */
create function public.cancel_document_upload(p_document uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documents;
begin
  select * into v_doc from public.documents where id = p_document for update;
  if v_doc.id is null or v_doc.status <> 'uploading'
     or not public.has_org_role(v_doc.org_id, array['owner', 'admin', 'reviewer', 'member']) then
    return false;
  end if;
  delete from public.documents where id = p_document;
  perform public.release_document_quota(v_doc.org_id, 1,
    date_trunc('month', v_doc.created_at at time zone coalesce(
      (select o.timezone from public.organizations o where o.id = v_doc.org_id), 'UTC'))::date);
  return true;
end;
$$;

/** Owners: remember the Stripe customer created for the org at checkout. */
create function public.set_stripe_customer(p_org uuid, p_customer text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_org_role(p_org, array['owner']) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.subscriptions (org_id, stripe_customer_id) values (p_org, p_customer)
  on conflict (org_id) do update set stripe_customer_id = excluded.stripe_customer_id
  where public.subscriptions.stripe_customer_id is null;
end;
$$;

/** Seats: members + open invites may not exceed the plan's seats (null = unlimited). */
create function public.enforce_seat_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_seats int;
  v_used int;
begin
  select seats into v_seats from public.plan_limits where plan = public.org_plan(new.org_id);
  if v_seats is null then
    return new;
  end if;
  select (select count(*) from public.memberships m where m.org_id = new.org_id)
       + (select count(*) from public.invites i
          where i.org_id = new.org_id and i.accepted_at is null and i.expires_at > now() and i.id <> new.id)
  into v_used;
  if v_used + 1 > v_seats then
    raise exception 'seat_limit' using errcode = 'P0001', hint = v_seats::text;
  end if;
  return new;
end;
$$;
create trigger enforce_seat_limit before insert on public.invites for each row execute function public.enforce_seat_limit();

revoke execute on function public.org_plan, public.org_usage_period from public, anon;
grant execute on function public.org_plan, public.org_usage_period to authenticated, service_role;
revoke execute on function public.consume_document_quota, public.org_usage, public.cancel_document_upload,
  public.set_stripe_customer from public, anon;
grant execute on function public.consume_document_quota, public.org_usage, public.cancel_document_upload,
  public.set_stripe_customer to authenticated, service_role;
-- Releasing quota is internal (cancel_document_upload, the app's own rollback via the service role): a user who
-- could call it could reset their own counter.
revoke execute on function public.release_document_quota from public, anon, authenticated;
grant execute on function public.release_document_quota to service_role;

alter publication supabase_realtime add table public.subscriptions;

/**
 * Start an upload: counts one document against the month's cap and creates the pending `documents` row, in one
 * transaction (a refused quota creates nothing; a failed insert consumes nothing). Writers only.
 */
create function public.create_document_upload(
  p_org uuid, p_id uuid, p_storage_path text, p_file_name text, p_mime_type text, p_size_bytes bigint,
  p_sha256 text, p_entity uuid
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.consume_document_quota(p_org, 1);
  insert into public.documents (id, org_id, uploaded_by, entity_id, storage_path, file_name, mime_type, size_bytes, sha256)
  values (p_id, p_org, auth.uid(), p_entity, p_storage_path, p_file_name, p_mime_type, p_size_bytes, p_sha256);
end;
$$;
revoke execute on function public.create_document_upload from public, anon;
grant execute on function public.create_document_upload to authenticated;
