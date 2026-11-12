-- Phase 11 — fixes from the security review (docs/phases/11-hardening.md):
--  1. Documents can only be created through create_document_upload (which counts quota). The old direct-insert
--     policy let writers skip the monthly cap, and cancel_document_upload then gave back quota that was never
--     consumed (resetting the counter).
--  2. Seats can't be bypassed by rewriting an accepted/expired invite: users may only change an open invite's role,
--     the seat trigger also runs on updates that reopen an invite, and accept_invite checks seats itself.

-- 1. -------------------------------------------------------------------------------------------------------
drop policy documents_insert on public.documents;
revoke insert on public.documents from authenticated, anon;

-- 2. -------------------------------------------------------------------------------------------------------
-- token_hash, email, accepted_at and expires_at are written only at creation (insert) and by accept_invite.
revoke update on public.invites from authenticated, anon;
grant update (role) on public.invites to authenticated;

create or replace function public.enforce_seat_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_seats int;
  v_used int;
begin
  -- Only an open invite takes a seat. An update of an invite that was already open changes nothing.
  if new.accepted_at is not null or new.expires_at <= now() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.accepted_at is null and old.expires_at > now() then
    return new;
  end if;
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
drop trigger enforce_seat_limit on public.invites;
create trigger enforce_seat_limit before insert or update on public.invites
  for each row execute function public.enforce_seat_limit();

create or replace function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.invites;
  v_seats int;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select * into v_invite from public.invites i
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  for update;

  if v_invite.id is null or v_invite.accepted_at is not null or v_invite.expires_at < now() then
    raise exception 'invite is invalid or has expired' using errcode = 'P0002';
  end if;
  if v_invite.email <> v_email then
    raise exception 'this invite was sent to a different email address' using errcode = '42501';
  end if;

  -- The invite held a seat; accepting turns it into a membership. Refuse if members alone already fill the plan
  -- (e.g. after a downgrade). Lock the org row so concurrent accepts are serialised.
  perform 1 from public.organizations o where o.id = v_invite.org_id for update;
  select seats into v_seats from public.plan_limits where plan = public.org_plan(v_invite.org_id);
  if v_seats is not null
     and not exists (select 1 from public.memberships m where m.org_id = v_invite.org_id and m.user_id = v_user)
     and (select count(*) from public.memberships m where m.org_id = v_invite.org_id) + 1 > v_seats then
    raise exception 'seat_limit' using errcode = 'P0001', hint = v_seats::text;
  end if;

  insert into public.memberships (org_id, user_id, role)
  values (v_invite.org_id, v_user, v_invite.role)
  on conflict (org_id, user_id) do nothing;
  update public.invites set accepted_at = now() where id = v_invite.id;
  update public.profiles set last_org_id = v_invite.org_id where id = v_user;
  return v_invite.org_id;
end;
$$;
