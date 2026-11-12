/**
 * Tenant isolation suite (docs/MULTI_TENANCY.md). Tenant tables are DISCOVERED from the catalog: every
 * `public` base table with an `org_id` column is tested automatically. A new table must register a seeder
 * below (the suite fails otherwise) — or be added to EXEMPT with a reason.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addMember,
  adminClient,
  anonClient,
  cleanup,
  createOrg,
  createUser,
  newInviteToken,
  pgClient,
  type TestUser,
} from "../helpers";

type Row = Record<string, unknown> & { id: string | number };
interface Ctx {
  a: TestUser;
  b: TestUser;
}
interface Seeder {
  /** A row belonging to `orgId` (created or looked up with the service role). */
  seed(ctx: Ctx, orgId: string): Promise<Row>;
  /** What an attacker in another org would try to insert into `orgId`. */
  insertPayload(ctx: Ctx, orgId: string): Record<string, unknown>;
  /** A harmless change to attempt on someone else's row. */
  update: Record<string, unknown>;
}

const admin = adminClient();
// Untyped view of a client: tenant tables are only known at runtime in this suite.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from(table: string): any };
const db = (c: unknown) => c as AnyDb;
const adminAny = db(admin);

async function one(table: string, filter: Record<string, unknown>): Promise<Row> {
  let q = adminAny.from(table).select("*");
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { data, error } = await q.limit(1).single();
  if (error) throw error;
  return data as Row;
}

const SEEDERS: Record<string, Seeder> = {
  memberships: {
    seed: (_ctx, orgId) => one("memberships", { org_id: orgId, role: "owner" }),
    // The most dangerous write: making yourself owner of someone else's org.
    insertPayload: (ctx, orgId) => ({ org_id: orgId, user_id: ctx.a.id, role: "owner" }),
    update: { role: "viewer" },
  },
  invites: {
    async seed(_ctx, orgId) {
      const { data, error } = await admin
        .from("invites")
        .insert({
          org_id: orgId,
          email: `seed-${newInviteToken().hash.slice(0, 6)}@example.test`,
          token_hash: newInviteToken().hash,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    insertPayload: (_ctx, orgId) => ({
      org_id: orgId,
      email: "intruder@example.test",
      token_hash: newInviteToken().hash,
    }),
    update: { role: "admin" },
  },
  entities: {
    async seed(_ctx, orgId) {
      const { data, error } = await admin
        .from("entities")
        .insert({ org_id: orgId, kind: "property", name: `Seed ${orgId.slice(0, 4)}` })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    insertPayload: (_ctx, orgId) => ({ org_id: orgId, kind: "property", name: "Intruder entity" }),
    update: { name: "Renamed by intruder" },
  },
  documents: {
    async seed(ctx, orgId) {
      const id = randomUUID();
      const { data, error } = await admin
        .from("documents")
        .insert({
          id,
          org_id: orgId,
          uploaded_by: null,
          storage_path: `${orgId}/documents/${id}/seed.pdf`,
          file_name: "seed.pdf",
          mime_type: "application/pdf",
          size_bytes: 1024,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    insertPayload(ctx, orgId) {
      const id = randomUUID();
      return {
        id,
        org_id: orgId,
        uploaded_by: ctx.a.id,
        storage_path: `${orgId}/documents/${id}/evil.pdf`,
        file_name: "evil.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
      };
    },
    update: { file_name: "renamed-by-intruder.pdf" },
  },
  extractions: {
    async seed(ctx, orgId) {
      const doc = await SEEDERS.documents.seed(ctx, orgId);
      const { data, error } = await admin
        .from("extractions")
        .insert({
          org_id: orgId,
          document_id: String(doc.id),
          provider: "seed",
          model: "seed",
          schema_version: 1,
          raw: {},
          fields: {},
          attempts: 1,
          latency_ms: 1,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    insertPayload: (_ctx, orgId) => ({
      org_id: orgId,
      document_id: rows.documents?.b.id,
      provider: "forged",
      model: "forged",
      schema_version: 1,
      raw: {},
      fields: {},
      attempts: 1,
      latency_ms: 1,
    }),
    update: { model: "tampered" },
  },
  records: {
    async seed(ctx, orgId) {
      const doc = await SEEDERS.documents.seed(ctx, orgId);
      const { data, error } = await admin
        .from("records")
        .insert({
          org_id: orgId,
          document_id: String(doc.id),
          supplier_name: "Seed Supplier",
          total_cents: 1000,
          min_confidence: 0.9,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    // Planting an approved record (with a large total) in someone else's books.
    insertPayload: (_ctx, orgId) => ({
      org_id: orgId,
      supplier_name: "Forged",
      total_cents: 999999,
      status: "approved",
      min_confidence: 1,
    }),
    update: { total_cents: 1, status: "approved" },
  },
  line_items: {
    async seed(ctx, orgId) {
      const record = await SEEDERS.records.seed(ctx, orgId);
      const { data, error } = await admin
        .from("line_items")
        .insert({
          org_id: orgId,
          record_id: String(record.id),
          position: 1,
          description: "seed",
          amount_cents: 1000,
          confidence: 0.9,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    insertPayload: (_ctx, orgId) => ({
      org_id: orgId,
      record_id: rows.records?.b.id,
      position: 99,
      description: "forged",
      amount_cents: 999999,
      confidence: 1,
    }),
    update: { amount_cents: 1 },
  },
  document_pages: {
    async seed(ctx, orgId) {
      const doc = await SEEDERS.documents.seed(ctx, orgId);
      const { data, error } = await admin
        .from("document_pages")
        .insert({
          org_id: orgId,
          document_id: String(doc.id),
          page_no: 1,
          text: "seed",
          source: "text_layer",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    // Writing pages into someone else's document.
    insertPayload: (_ctx, orgId) => ({
      org_id: orgId,
      document_id: rows.documents?.b.id,
      page_no: 2,
      text: "forged",
      source: "text_layer",
    }),
    update: { text: "tampered" },
  },
  audit_log: {
    seed: (_ctx, orgId) => one("audit_log", { org_id: orgId }),
    insertPayload: (_ctx, orgId) => ({
      org_id: orgId,
      table_name: "organizations",
      row_id: "forged",
      action: "insert",
    }),
    update: { table_name: "tampered" },
  },
};

/** Tables that may skip the suite. Each entry needs a comment explaining why. */
const EXEMPT: string[] = [];

const pgc = await pgClient();
const discovered: string[] = (
  await pgc.query<{ table_name: string }>(`
    select c.table_name from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'org_id' and t.table_type = 'BASE TABLE'
    order by 1`)
).rows.map((r) => r.table_name);
const tenantTables = discovered.filter((t) => !EXEMPT.includes(t));

const ctx = {} as Ctx & { orgA: string; orgB: string; viewer: TestUser };
const rows: Record<string, { a: Row; b: Row }> = {};

beforeAll(async () => {
  ctx.a = await createUser("iso-a");
  ctx.b = await createUser("iso-b");
  ctx.viewer = await createUser("iso-viewer");
  ctx.orgA = (await createOrg(ctx.a, "Isolation A")).id;
  ctx.orgB = (await createOrg(ctx.b, "Isolation B", "job")).id;
  await addMember(ctx.orgA, ctx.viewer, "viewer");
  for (const t of tenantTables) {
    const seeder = SEEDERS[t];
    if (!seeder) continue; // reported by the "has a seeder" test
    rows[t] = { a: await seeder.seed(ctx, ctx.orgA), b: await seeder.seed(ctx, ctx.orgB) };
  }
});

afterAll(async () => {
  await cleanup([ctx.orgA, ctx.orgB].filter(Boolean), [ctx.a, ctx.b, ctx.viewer].filter(Boolean));
  await pgc.end();
});

describe("discovery", () => {
  it("finds the Phase 2 tenant tables", () => {
    expect(discovered).toEqual(expect.arrayContaining(["memberships", "invites", "audit_log"]));
  });

  it.each(tenantTables)("%s has a seeder registered in this suite", (table) => {
    expect(
      SEEDERS[table],
      `Add a seeder for "${table}" to tests/integration/tenancy/isolation.test.ts`,
    ).toBeDefined();
  });

  it("RLS is enabled AND forced on every public table", async () => {
    const { rows: tables } = await pgc.query<{ relname: string; rls: boolean; forced: boolean }>(`
      select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as forced
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'`);
    const bad = tables.filter((t) => !t.rls || !t.forced).map((t) => t.relname);
    expect(bad, "tables without enabled+forced RLS").toEqual([]);
  });
});

describe.each(tenantTables)("%s — user A against Org B", (table) => {
  const from = (u: TestUser) => db(u.client).from(table);

  it("1. select all returns no Org B rows", async () => {
    const { data, error } = await from(ctx.a).select("org_id");
    expect(error).toBeNull();
    expect((data as Row[]).filter((r) => r.org_id === ctx.orgB)).toEqual([]);
  });

  it("2. select by Org B row id is empty", async () => {
    const { data, error } = await from(ctx.a).select("*").eq("id", rows[table].b.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("3. insert with org_id = B is an RLS violation", async () => {
    const { error } = await from(ctx.a).insert(SEEDERS[table].insertPayload(ctx, ctx.orgB));
    expect(error?.code).toBe("42501");
  });

  it("4. update of an Org B row affects 0 rows", async () => {
    const { data, error } = await from(ctx.a)
      .update(SEEDERS[table].update)
      .eq("id", rows[table].b.id)
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await one(table, { id: rows[table].b.id })).toEqual(rows[table].b);
  });

  it("5. delete of an Org B row affects 0 rows", async () => {
    const { data, error } = await from(ctx.a).delete().eq("id", rows[table].b.id).select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await one(table, { id: rows[table].b.id })).toBeTruthy();
  });

  it("6. moving an own row to org B is rejected", async () => {
    const { data, error } = await from(ctx.a)
      .update({ org_id: ctx.orgB })
      .eq("id", rows[table].a.id)
      .select();
    expect(error !== null || (data as Row[]).length === 0).toBe(true);
    expect((await one(table, { id: rows[table].a.id })).org_id).toBe(ctx.orgA);
  });

  it("anonymous users see nothing", async () => {
    const res = await db(anonClient()).from(table).select("*");
    expect(res.data ?? []).toEqual([]);
  });

  it("viewer cannot insert into their own org", async () => {
    const { error } = await from(ctx.viewer).insert(SEEDERS[table].insertPayload(ctx, ctx.orgA));
    expect(error?.code).toBe("42501");
  });

  it("viewer cannot update or delete their own org's rows", async () => {
    const upd = await from(ctx.viewer).update(SEEDERS[table].update).eq("id", rows[table].a.id).select();
    expect(upd.error !== null || (upd.data as Row[]).length === 0).toBe(true);
    const del = await from(ctx.viewer).delete().eq("id", rows[table].a.id).select();
    expect(del.error !== null || (del.data as Row[]).length === 0).toBe(true);
    expect(await one(table, { id: rows[table].a.id })).toEqual(rows[table].a);
  });
});

describe("organizations (scoped by id)", () => {
  it("a user sees only orgs they belong to", async () => {
    const { data } = await ctx.a.client.from("organizations").select("id");
    expect(data?.map((o) => o.id)).toEqual([ctx.orgA]);
  });

  it("cannot update or delete another org", async () => {
    const upd = await ctx.a.client
      .from("organizations")
      .update({ name: "Hijacked" })
      .eq("id", ctx.orgB)
      .select();
    expect(upd.data).toEqual([]);
    const del = await ctx.a.client.from("organizations").delete().eq("id", ctx.orgB).select();
    expect(del.data).toEqual([]);
    expect((await one("organizations", { id: ctx.orgB })).name).toBe("Isolation B");
  });

  it("cannot be inserted directly (only via create_organization)", async () => {
    const { error } = await ctx.a.client
      .from("organizations")
      .insert({ name: "Direct", slug: "direct-insert", entity_kind: "job" });
    expect(error?.code).toBe("42501");
  });

  it("viewer cannot update their org", async () => {
    const { data } = await ctx.viewer.client
      .from("organizations")
      .update({ name: "Viewer edit" })
      .eq("id", ctx.orgA)
      .select();
    expect(data).toEqual([]);
  });

  it("anonymous users see no organizations", async () => {
    const { data } = await anonClient().from("organizations").select("id");
    expect(data ?? []).toEqual([]);
  });
});

describe("profiles", () => {
  it("are visible to self and co-members only", async () => {
    const { data } = await ctx.a.client.from("profiles").select("id");
    const ids = data?.map((p) => p.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining([ctx.a.id, ctx.viewer.id]));
    expect(ids).not.toContain(ctx.b.id);
  });

  it("cannot update someone else's profile", async () => {
    const { data } = await ctx.a.client
      .from("profiles")
      .update({ full_name: "Renamed" })
      .eq("id", ctx.b.id)
      .select();
    expect(data).toEqual([]);
  });

  it("cannot point last_org_id at an org you don't belong to", async () => {
    const { error } = await ctx.a.client
      .from("profiles")
      .update({ last_org_id: ctx.orgB })
      .eq("id", ctx.a.id);
    expect(error?.code).toBe("42501");
  });

  it("anonymous users see no profiles", async () => {
    const { data } = await anonClient().from("profiles").select("id");
    expect(data ?? []).toEqual([]);
  });
});
