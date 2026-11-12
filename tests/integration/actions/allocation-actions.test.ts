import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildStatement } from "@/lib/calc/statement";
import { monthPeriod } from "@/lib/calc/period";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs } from "../next-mocks";

const actions = await import("@/features/allocations/actions");
const { loadStatementRecords } = await import("@/features/statements/queries");
const admin = adminClient();
let owner: TestUser, reviewer: TestUser, member: TestUser, outsider: TestUser;
let orgId: string, otherOrgId: string;
let elm: string, oak: string, foreignEntity: string;

async function seedRecord(over: Record<string, unknown> = {}, org = orgId) {
  const { data, error } = await admin
    .from("records")
    .insert({
      org_id: org,
      document_type: "invoice",
      supplier_name: "Green Thumb",
      issue_date: "2026-10-03",
      currency: "USD",
      tax_cents: 0,
      total_cents: 45000,
      entity_id: org === orgId ? elm : null,
      min_confidence: 1,
      field_confidence: {},
      status: "approved",
      ...over,
    } as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}
const allocationsOf = async (recordId: string) =>
  (
    await admin
      .from("allocations")
      .select("entity_id, line_item_id, method, percent_bp, amount_cents, created_by")
      .eq("record_id", recordId)
      .order("created_at")
  ).data ?? [];

beforeAll(async () => {
  [owner, reviewer, member, outsider] = await Promise.all(
    ["al-owner", "al-rev", "al-mem", "al-out"].map(createUser),
  );
  orgId = (await createOrg(owner, "Alloc Org")).id;
  otherOrgId = (await createOrg(outsider, "Other Alloc Org")).id;
  await addMember(orgId, reviewer, "reviewer");
  await addMember(orgId, member, "member");
  const ins = async (org: string, name: string) =>
    (await admin.from("entities").insert({ org_id: org, kind: "property", name }).select("id").single()).data!
      .id;
  [elm, oak, foreignEntity] = await Promise.all([
    ins(orgId, "12 Elm"),
    ins(orgId, "4 Oak"),
    ins(otherOrgId, "Elsewhere"),
  ]);
});
afterAll(() => cleanup([orgId, otherOrgId], [owner, reviewer, member, outsider]));

describe("setAllocations", () => {
  it("reviewers split by percent; rows are audited with the actor", async () => {
    const recordId = await seedRecord();
    actAs(reviewer);
    const res = await actions.setAllocations({
      recordId,
      method: "percent",
      splits: [
        { entityId: elm, percentBp: 6000 },
        { entityId: oak, percentBp: 4000 },
      ],
    });
    expect(res).toEqual({ ok: true, data: { rows: 2 } });
    expect(await allocationsOf(recordId)).toEqual([
      expect.objectContaining({
        entity_id: elm,
        method: "percent",
        percent_bp: 6000,
        created_by: reviewer.id,
      }),
      expect.objectContaining({
        entity_id: oak,
        method: "percent",
        percent_bp: 4000,
        created_by: reviewer.id,
      }),
    ]);
    const { count } = await admin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("table_name", "allocations")
      .eq("actor_id", reviewer.id);
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("replaces the previous split; an empty list removes it", async () => {
    const recordId = await seedRecord();
    actAs(owner);
    await actions.setAllocations({
      recordId,
      method: "percent",
      splits: [{ entityId: oak, percentBp: 10000 }],
    });
    expect(
      await actions.setAllocations({
        recordId,
        method: "amount",
        splits: [{ entityId: oak, amountCents: 20000 }],
      }),
    ).toEqual({ ok: true, data: { rows: 1 } });
    expect(await allocationsOf(recordId)).toEqual([
      expect.objectContaining({ method: "amount", amount_cents: 20000 }),
    ]);
    expect(await actions.setAllocations({ recordId, method: "percent", splits: [] })).toEqual({
      ok: true,
      data: { rows: 0 },
    });
    expect(await allocationsOf(recordId)).toEqual([]);
  });

  it("rejects invalid splits with readable messages (lib/calc first, the database too)", async () => {
    const recordId = await seedRecord();
    actAs(reviewer);
    expect(
      await actions.setAllocations({
        recordId,
        method: "percent",
        splits: [{ entityId: elm, percentBp: 6000 }],
      }),
    ).toEqual({ ok: false, error: "Percentages must add up to 100%." });
    expect(
      await actions.setAllocations({
        recordId,
        method: "amount",
        splits: [{ entityId: oak, amountCents: 45001 }],
      }),
    ).toEqual({ ok: false, error: "The amounts add up to more than the total." });
    // Straight to the database, skipping the action's checks:
    const { error } = await reviewer.client.rpc("set_allocations", {
      p_record: recordId,
      p_line_item: null as unknown as string,
      p_method: "percent",
      p_splits: [{ entity_id: elm, percent_bp: 9000 }],
    });
    expect(error?.message).toBe("percentages must add up to 100%");
    const foreign = await reviewer.client.rpc("set_allocations", {
      p_record: recordId,
      p_line_item: null as unknown as string,
      p_method: "percent",
      p_splits: [{ entity_id: foreignEntity, percent_bp: 10000 }],
    });
    expect(foreign.error?.message).toBe("unknown entity");
    expect(await allocationsOf(recordId)).toEqual([]);
  });

  it("members, other orgs and rejected records are refused", async () => {
    const recordId = await seedRecord();
    actAs(member);
    expect((await actions.setAllocations({ recordId, method: "percent", splits: [] })).ok).toBe(false);
    const { error } = await member.client.rpc("set_allocations", {
      p_record: recordId,
      p_line_item: null as unknown as string,
      p_method: "percent",
      p_splits: [],
    });
    expect(error?.code).toBe("P0002");

    const foreignRecord = await seedRecord({}, otherOrgId);
    actAs(reviewer);
    expect(await actions.setAllocations({ recordId: foreignRecord, method: "percent", splits: [] })).toEqual({
      ok: false,
      error: "Record not found.",
    });

    const rejected = await seedRecord({ status: "rejected" });
    expect(
      await actions.setAllocations({
        recordId: rejected,
        method: "percent",
        splits: [{ entityId: oak, percentBp: 10000 }],
      }),
    ).toEqual({ ok: false, error: "A rejected record can't be split." });
  });

  it("line-level and record-level splits replace each other", async () => {
    const recordId = await seedRecord();
    const { data: line } = await admin
      .from("line_items")
      .insert({ org_id: orgId, record_id: recordId, position: 1, amount_cents: 45000, confidence: 1 })
      .select("id")
      .single();
    actAs(reviewer);
    await actions.setAllocations({
      recordId,
      method: "percent",
      splits: [{ entityId: oak, percentBp: 10000 }],
    });
    expect(
      await actions.setAllocations({
        recordId,
        lineItemId: line!.id,
        method: "percent",
        splits: [{ entityId: oak, percentBp: 10000 }],
      }),
    ).toEqual({ ok: true, data: { rows: 1 } });
    expect(await allocationsOf(recordId)).toEqual([expect.objectContaining({ line_item_id: line!.id })]);
  });
});

describe("statement data", () => {
  it("an entity's statement includes records split to it, and statements reconcile across entities", async () => {
    const shared = await seedRecord({
      supplier_name: "Shared Co",
      issue_date: "2026-08-10",
      total_cents: 10001,
    });
    await seedRecord({ supplier_name: "Elm only", issue_date: "2026-08-12", total_cents: 5000 });
    await seedRecord({
      supplier_name: "Pending",
      issue_date: "2026-08-12",
      total_cents: 7000,
      status: "needs_review",
    });
    actAs(reviewer);
    await actions.setAllocations({
      recordId: shared,
      method: "percent",
      splits: [
        { entityId: elm, percentBp: 5000 },
        { entityId: oak, percentBp: 5000 },
      ],
    });
    const august = monthPeriod("2026-08");
    const build = async (id: string, name: string) =>
      buildStatement({
        org: { name: "Alloc Org" },
        entity: { id, name, code: null, address: null, clientName: null },
        period: august,
        currency: "USD",
        records: await loadStatementRecords(orgId, august, id),
        generatedAt: "",
      });
    const [elmStatement, oakStatement] = await Promise.all([build(elm, "12 Elm"), build(oak, "4 Oak")]);
    expect(oakStatement.summary.gross).toBe(5000); // half of 100.01, largest remainder → the first gets the cent
    expect(elmStatement.summary.gross).toBe(5001 + 5000);
    expect(elmStatement.summary.gross + oakStatement.summary.gross).toBe(10001 + 5000);
    expect(elmStatement.lines.map((l) => l.supplier).sort()).toEqual(["Elm only", "Shared Co"]);
  });
});
