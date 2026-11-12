import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import pg from "pg";
import type { Database } from "@/lib/supabase/database.types";

export type Db = SupabaseClient<Database>;
export type OrgRole = Database["public"]["Enums"]["org_role"];

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Service-role client — test setup and assertions only. */
export function adminClient(): Db {
  return createClient<Database>(url(), process.env.SUPABASE_SERVICE_ROLE_KEY as string, noSession);
}

export function anonClient(): Db {
  return createClient<Database>(url(), anonKey(), noSession);
}

/** Direct Postgres connection (catalog introspection, actor-setting tests). */
export async function pgClient(): Promise<pg.Client> {
  const client = new pg.Client({
    connectionString:
      process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });
  await client.connect();
  return client;
}

export interface TestUser {
  id: string;
  email: string;
  client: Db;
}

const PASSWORD = "integration-Test-password-1";

/** Creates a confirmed auth user and returns a client signed in as them. */
export async function createUser(label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@example.test`;
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}

/**
 * Creates an org through the real RPC (the caller becomes its owner). Test orgs are on an active Business subscription unless `plan` says otherwise, so
 * seat and document caps (Phase 10) only matter in the tests about them.
 */
export async function createOrg(
  owner: TestUser,
  name: string,
  kind: "property" | "job" = "property",
  { plan = "business" }: { plan?: "free" | "pro" | "business" | "enterprise" } = {},
) {
  const { data, error } = await owner.client.rpc("create_organization", {
    p_name: name,
    p_entity_kind: kind,
  });
  if (error || !data) throw error ?? new Error("create_organization failed");
  if (plan !== "free") await setPlan(data.id, plan);
  return data;
}

/** Puts an org on a plan as if Stripe said so (service role). */
export async function setPlan(
  orgId: string,
  plan: "free" | "pro" | "business" | "enterprise",
  status = "active",
) {
  const { error } = await adminClient()
    .from("subscriptions")
    .upsert({ org_id: orgId, plan, status }, { onConflict: "org_id" });
  if (error) throw error;
}

/** Adds a member directly (service role) — invites are covered by their own tests. */
export async function addMember(orgId: string, user: TestUser, role: OrgRole) {
  const { error } = await adminClient().from("memberships").insert({ org_id: orgId, user_id: user.id, role });
  if (error) throw error;
}

export function newInviteToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

/** Deletes test orgs (cascades tenant rows) and users. */
export async function cleanup(orgIds: string[], users: TestUser[]) {
  const admin = adminClient();
  if (orgIds.length) await admin.from("organizations").delete().in("id", orgIds);
  for (const u of users) {
    await u.client.removeAllChannels();
    await admin.auth.admin.deleteUser(u.id);
  }
}

export async function waitFor(predicate: () => boolean, timeoutMs = 10_000, stepMs = 100) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
