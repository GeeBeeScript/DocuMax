-- Phase 2 — Tenancy foundation: organizations, profiles, memberships, invites, audit_log.
-- See docs/MULTI_TENANCY.md and docs/DATA_MODEL.md.
--
-- Role matrix (✓ = allowed via RLS; "rpc" = only through a security-definer function below)
--
-- | table         | select              | insert | update                       | delete                          |
-- | ------------- | ------------------- | ------ | ---------------------------- | ------------------------------- |
-- | organizations | member              | rpc    | owner, admin                 | owner                           |
-- | profiles      | self + co-members   | rpc*   | self                         | — (cascades from auth.users)    |
-- | memberships   | member              | rpc    | owner, admin (owner-guarded) | owner, admin, or self (leave)   |
-- | invites       | owner, admin        | o, a   | owner, admin                 | owner, admin                    |
-- | audit_log     | owner, admin        | trig.  | — (append-only)              | — (append-only)                 |
--
-- * profiles are created by a trigger on auth.users.
-- Guards (triggers): org_id is immutable on every tenant table; only owners grant/revoke/remove the owner
-- role; an organization always keeps at least one owner.

-- ---------------------------------------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------------------------------------
create type public.org_role as enum ('owner', 'admin', 'reviewer', 'member', 'viewer');
create type public.entity_kind as enum ('property', 'job');
create type public.audit_action as enum ('insert', 'update', 'delete');

-- ---------------------------------------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  entity_kind public.entity_kind not null,
  logo_path text,
  brand_color text check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  default_currency char(3) not null default 'USD' check (default_currency ~ '^[A-Z]{3}$'),
  review_threshold numeric(3, 2) not null default 0.85 check (review_threshold between 0 and 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_path text,
  -- UI preference only; never used for authorization (RLS checks memberships).
  last_org_id uuid references public.organizations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  -- profiles.id = auth.users.id (cascades); referencing profiles lets PostgREST embed the member's profile.
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+$'),
  role public.org_role not null default 'member' check (role <> 'owner'),
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invites_org_id_idx on public.invites (org_id);
create unique index invites_open_email_idx on public.invites (org_id, email) where accepted_at is null;

create table public.audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid,
  table_name text not null,
  row_id text not null,
  action public.audit_action not null,
  before jsonb,
  after jsonb,
  diff jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_org_created_idx on public.audit_log (org_id, created_at desc);
create index audit_log_row_idx on public.audit_log (table_name, row_id);

-- ---------------------------------------------------------------------------------------------------------
-- Helper functions (security definer: owned by postgres, which has BYPASSRLS, so no policy recursion)
-- ---------------------------------------------------------------------------------------------------------
create function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = auth.uid());
$$;

create function public.has_org_role(p_org uuid, p_roles text[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
                 where m.org_id = p_org and m.user_id = auth.uid() and m.role::text = any(p_roles));
$$;

/** Org id from a storage object path `{org_id}/…`, or null when the first segment isn't a uuid. */
create function public.storage_org_id(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

/** Users who share at least one org with the caller (for showing teammates' profiles). */
create function public.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships mine
                 join public.memberships theirs on theirs.org_id = mine.org_id
                 where mine.user_id = auth.uid() and theirs.user_id = p_user);
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

/** org_id is immutable: a row can never be moved to another tenant. */
create function public.prevent_org_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.org_id is distinct from old.org_id then
    raise exception 'org_id is immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;

/**
 * Writes one audit_log row per insert/update/delete. Actor = `app.actor_id` setting (worker sets it inside its
 * transaction) or else auth.uid(). Skips rows whose organization no longer exists (org deletion cascades).
 */
create function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid := case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid
                     else (v_row ->> 'org_id')::uuid end;
  v_actor uuid := coalesce(nullif(current_setting('app.actor_id', true), '')::uuid, auth.uid());
  v_diff jsonb;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org) then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, n.value), '{}'::jsonb) into v_diff
    from jsonb_each(v_new) n
    where n.key <> 'updated_at' and n.value is distinct from v_old -> n.key;
    if v_diff = '{}'::jsonb then
      return null; -- no-op update (e.g. only updated_at)
    end if;
  end if;

  insert into public.audit_log (org_id, actor_id, table_name, row_id, action, before, after, diff)
  values (v_org, v_actor, tg_table_name, v_row ->> 'id', lower(tg_op)::public.audit_action, v_old, v_new, v_diff);
  return null;
end;
$$;

/**
 * Membership guards. Bypassed when there is no end user (service role / migrations: auth.uid() is null)
 * and when the organization itself is being deleted.
 */
create function public.guard_membership_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := coalesce(new.org_id, old.org_id);
  v_owners int;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org) then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE' and new.user_id is distinct from old.user_id then
    raise exception 'membership user_id is immutable' using errcode = '42501';
  end if;

  if auth.uid() is not null then
    -- Only owners may grant, revoke or remove the owner role.
    if (old.role = 'owner' or (tg_op = 'UPDATE' and new.role = 'owner'))
       and not public.has_org_role(v_org, array['owner'])
       and not (tg_op = 'DELETE' and old.user_id = auth.uid()) then
      raise exception 'only owners can change owner memberships' using errcode = '42501';
    end if;
  end if;

  -- Always keep at least one owner.
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    select count(*) into v_owners from public.memberships m where m.org_id = v_org and m.role = 'owner';
    if v_owners <= 1 then
      raise exception 'an organization must keep at least one owner' using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- Profile row for every auth user; email kept in sync for the members page.
create function public.handle_auth_user_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.profiles (id, email, full_name)
    values (new.id, lower(coalesce(new.email, '')), nullif(new.raw_user_meta_data ->> 'full_name', ''));
  elsif new.email is distinct from old.email then
    update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_change
  after insert or update of email on auth.users
  for each row execute function public.handle_auth_user_change();

-- ---------------------------------------------------------------------------------------------------------
-- Trigger wiring
-- ---------------------------------------------------------------------------------------------------------
create trigger set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.memberships for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invites for each row execute function public.set_updated_at();

create trigger prevent_org_change before update on public.memberships for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.invites for each row execute function public.prevent_org_change();
create trigger prevent_org_change before update on public.audit_log for each row execute function public.prevent_org_change();

create trigger guard_membership_change before update or delete on public.memberships
  for each row execute function public.guard_membership_change();

create trigger audit after insert or update or delete on public.organizations for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.memberships for each row execute function public.audit_row_change();
create trigger audit after insert or update or delete on public.invites for each row execute function public.audit_row_change();

-- ---------------------------------------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organizations force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;
alter table public.invites enable row level security;
alter table public.invites force row level security;
alter table public.audit_log enable row level security;
alter table public.audit_log force row level security;

create policy organizations_select on public.organizations for select using (public.is_org_member(id));
create policy organizations_update on public.organizations for update
  using (public.has_org_role(id, array['owner', 'admin'])) with check (public.has_org_role(id, array['owner', 'admin']));
create policy organizations_delete on public.organizations for delete using (public.has_org_role(id, array['owner']));

create policy profiles_select on public.profiles for select using (id = auth.uid() or public.shares_org_with(id));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (
  id = auth.uid() and (last_org_id is null or public.is_org_member(last_org_id))
);

create policy memberships_select on public.memberships for select using (public.is_org_member(org_id));
create policy memberships_update on public.memberships for update
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));
create policy memberships_delete on public.memberships for delete
  using (public.has_org_role(org_id, array['owner', 'admin']) or user_id = auth.uid());

create policy invites_select on public.invites for select using (public.has_org_role(org_id, array['owner', 'admin']));
create policy invites_insert on public.invites for insert with check (public.has_org_role(org_id, array['owner', 'admin']));
create policy invites_update on public.invites for update
  using (public.has_org_role(org_id, array['owner', 'admin']))
  with check (public.has_org_role(org_id, array['owner', 'admin']));
create policy invites_delete on public.invites for delete using (public.has_org_role(org_id, array['owner', 'admin']));

create policy audit_log_select on public.audit_log for select using (public.has_org_role(org_id, array['owner', 'admin']));

-- ---------------------------------------------------------------------------------------------------------
-- RPCs (the only way to create organizations / memberships as an end user)
-- ---------------------------------------------------------------------------------------------------------
create function public.slugify(p_text text) returns text
language sql immutable set search_path = '' as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(lower(p_text), '[^a-z0-9]+', '-', 'g')), ''), 'org');
$$;

/** Creates an organization owned by the caller and makes it their active org. */
create function public.create_organization(p_name text, p_entity_kind public.entity_kind)
returns public.organizations
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_base text := left(public.slugify(p_name), 48);
  v_slug text := v_base;
  v_n int := 1;
  v_org public.organizations;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  while exists (select 1 from public.organizations o where o.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.organizations (name, slug, entity_kind, created_by)
  values (trim(p_name), v_slug, p_entity_kind, v_user)
  returning * into v_org;

  insert into public.memberships (org_id, user_id, role) values (v_org.id, v_user, 'owner');
  update public.profiles set last_org_id = v_org.id where id = v_user;
  return v_org;
end;
$$;

/**
 * Accepts an invite by its raw token (only the sha256 hash is stored). The signed-in user's email must match
 * the invite. Returns the org id.
 */
create function public.accept_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.invites;
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

  insert into public.memberships (org_id, user_id, role)
  values (v_invite.org_id, v_user, v_invite.role)
  on conflict (org_id, user_id) do nothing;
  update public.invites set accepted_at = now() where id = v_invite.id;
  update public.profiles set last_org_id = v_invite.org_id where id = v_user;
  return v_invite.org_id;
end;
$$;

/** Public preview of an invite (org name, role, email) for the accept page — no other data. */
create function public.invite_preview(p_token text)
returns table (org_name text, role public.org_role, email text, expired boolean, accepted boolean)
language sql stable security definer set search_path = '' as $$
  select o.name, i.role, i.email, i.expires_at < now(), i.accepted_at is not null
  from public.invites i join public.organizations o on o.id = i.org_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

revoke execute on function public.create_organization(text, public.entity_kind) from public, anon;
revoke execute on function public.accept_invite(text) from public, anon;
grant execute on function public.create_organization(text, public.entity_kind) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- Storage: private buckets, paths `{org_id}/…`
-- ---------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false), ('reports', 'reports', false),
       ('imports', 'imports', false), ('branding', 'branding', false)
on conflict (id) do nothing;

create policy tenant_objects_select on storage.objects for select to authenticated using (
  bucket_id in ('documents', 'reports', 'imports', 'branding') and public.is_org_member(public.storage_org_id(name))
);
create policy tenant_objects_insert on storage.objects for insert to authenticated with check (
  bucket_id in ('documents', 'reports', 'imports', 'branding')
  and public.has_org_role(public.storage_org_id(name), array['owner', 'admin', 'reviewer', 'member'])
);
create policy tenant_objects_update on storage.objects for update to authenticated
  using (bucket_id in ('documents', 'reports', 'imports', 'branding')
         and public.has_org_role(public.storage_org_id(name), array['owner', 'admin', 'reviewer', 'member']))
  with check (bucket_id in ('documents', 'reports', 'imports', 'branding')
              and public.has_org_role(public.storage_org_id(name), array['owner', 'admin', 'reviewer', 'member']));
create policy tenant_objects_delete on storage.objects for delete to authenticated using (
  bucket_id in ('documents', 'reports', 'imports', 'branding')
  and public.has_org_role(public.storage_org_id(name), array['owner', 'admin'])
);

-- ---------------------------------------------------------------------------------------------------------
-- Realtime: membership changes stream to members (RLS applies to postgres_changes).
-- ---------------------------------------------------------------------------------------------------------
alter publication supabase_realtime add table public.memberships;
