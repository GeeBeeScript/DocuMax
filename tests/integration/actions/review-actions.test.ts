import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs } from "../next-mocks";

const actions = await import("@/features/review/actions");
const admin = adminClient();
let owner: TestUser, reviewer: TestUser, member: TestUser, outsider: TestUser;
let orgId: string, otherOrgId: string, entityId: string;

/** A record in review (as the worker leaves it) with the given values and issues. */
async function seedRecord(
  overrides: Record<string, unknown> = {},
  issues: { code: string; severity: string; field?: string }[] = [],
  org = orgId,
) {
  const docId = randomUUID();
  await admin.from("documents").insert({
    id: docId,
    org_id: org,
    storage_path: `${org}/documents/${docId}/x.pdf`,
    file_name: `inv-${docId.slice(0, 4)}.pdf`,
    mime_type: "application/pdf",
    size_bytes: 10,
    status: "needs_review",
  } as never);
  const { data: record } = await admin
    .from("records")
    .insert({
      org_id: org,
      document_id: docId,
      document_type: "invoice",
      supplier_name: `Supplier ${docId.slice(0, 6)}`,
      invoice_number: `N-${docId.slice(0, 6)}`,
      issue_date: "2026-10-14",
      currency: "USD",
      subtotal_cents: 116450,
      tax_cents: 9607,
      total_cents: 126099, // mismatch: should be 126057
      entity_id: org === orgId ? entityId : null,
      min_confidence: 0.6,
      field_confidence: {
        supplier_name: 0.97,
        issue_date: 0.97,
        total_cents: 0.6,
        currency: 0.95,
        invoice_number: 0.97,
      },
      ...overrides,
    } as never)
    .select()
    .single();
  if (issues.length) {
    await admin
      .from("validation_issues")
      .insert(issues.map((i) => ({ org_id: org, record_id: record!.id, message: "seed", ...i })) as never);
  }
  return { recordId: record!.id as string, documentId: docId };
}
const recordRow = async (id: string) => (await admin.from("records").select("*").eq("id", id).single()).data!;
const issueCodes = async (id: string) =>
  ((await admin.from("validation_issues").select("code, resolved_at").eq("record_id", id)).data ?? [])
    .map((i) => i.code)
    .sort();
const reviewRows = async (id: string) =>
  (
    await admin
      .from("review_actions")
      .select("action, field, before, after, reason, actor_id")
      .eq("record_id", id)
      .order("created_at")
  ).data ?? [];

beforeAll(async () => {
  [owner, reviewer, member, outsider] = await Promise.all(
    ["rv-owner", "rv-reviewer", "rv-member", "rv-out"].map(createUser),
  );
  orgId = (await createOrg(owner, "Review Org")).id;
  otherOrgId = (await createOrg(outsider, "Other Review Org")).id;
  await addMember(orgId, reviewer, "reviewer");
  await addMember(orgId, member, "member");
  entityId = (
    await admin.from("entities").insert({ org_id: orgId, kind: "property", name: "Elm" }).select().single()
  ).data!.id;
});
afterAll(() => cleanup([orgId, otherOrgId], [owner, reviewer, member, outsider]));

describe("reviewRecord — corrections", () => {
  it("members cannot review", async () => {
    const { recordId } = await seedRecord();
    actAs(member);
    expect(await actions.reviewRecord({ recordId, action: "approve" })).toMatchObject({
      ok: false,
      error: expect.stringMatching(/permission/),
    });
  });

  it("a correction clears its issue at once, sets that field's confidence to 1, and is recorded with before/after", async () => {
    const { recordId } = await seedRecord({}, [
      { code: "total_mismatch", severity: "error", field: "total_cents" },
    ]);
    actAs(reviewer);
    const res = await actions.reviewRecord({
      recordId,
      action: "correct",
      fields: { total_cents: 126057 },
      reason: "Checked the PDF",
    });
    expect(res).toMatchObject({ ok: true, data: { status: "needs_review" } });
    expect(res.ok && res.data.issues.map((i) => i.code)).toEqual([]);
    expect(await issueCodes(recordId)).toEqual([]);
    const row = await recordRow(recordId);
    expect(row).toMatchObject({ total_cents: 126057, status: "needs_review" });
    expect((row.field_confidence as Record<string, number>).total_cents).toBe(1);
    expect(Number(row.min_confidence)).toBe(0.95);
    expect(await reviewRows(recordId)).toEqual([
      {
        action: "correct",
        field: "total_cents",
        before: 126099,
        after: 126057,
        reason: "Checked the PDF",
        actor_id: reviewer.id,
      },
    ]);
    const { data: audit } = await admin
      .from("audit_log")
      .select("actor_id, diff")
      .eq("row_id", recordId)
      .eq("action", "update")
      .order("id", { ascending: false })
      .limit(1)
      .single();
    expect(audit).toMatchObject({
      actor_id: reviewer.id,
      diff: expect.objectContaining({ total_cents: 126057 }),
    });
  });

  it("re-validates server-side: a correction that introduces a problem creates its issue", async () => {
    const { recordId } = await seedRecord({ total_cents: 126057 });
    actAs(reviewer);
    const res = await actions.reviewRecord({ recordId, action: "correct", fields: { currency: null } });
    // total_cents was never corrected, so its 0.6 confidence still flags the record.
    expect(res.ok && res.data.issues.map((i) => i.code).sort()).toEqual(["low_confidence", "missing_field"]);
    expect(await issueCodes(recordId)).toEqual(["low_confidence", "missing_field"]);
  });

  it("line items are replaced as a whole and recorded once; assigning an entity updates the document", async () => {
    const { recordId, documentId } = await seedRecord({ total_cents: 126057, entity_id: null });
    actAs(reviewer);
    const lines = [
      {
        position: 1,
        description: "Valve",
        quantity: "1",
        unit_price_cents: 42000,
        amount_cents: 42000,
        category: "repairs_maintenance" as const,
      },
      {
        position: 2,
        description: "Labor",
        quantity: "3.5",
        unit_price_cents: 16000,
        amount_cents: 74450,
        category: "labor_subcontract" as const,
      },
    ];
    const res = await actions.reviewRecord({
      recordId,
      action: "correct",
      lines,
      fields: { entity_id: entityId },
    });
    // 3.5 × 160.00 ≠ 744.50; total_cents keeps its seeded 0.6 confidence.
    expect(res.ok && res.data.issues.map((i) => i.code).sort()).toEqual(["line_math", "low_confidence"]);
    expect((await admin.from("line_items").select("position").eq("record_id", recordId)).data).toHaveLength(
      2,
    );
    expect((await reviewRows(recordId)).map((r) => r.field).sort()).toEqual(["entity_id", "line_items"]);
    expect(
      (await admin.from("documents").select("entity_id").eq("id", documentId).single()).data?.entity_id,
    ).toBe(entityId);
  });

  it("rejects unknown fields and invalid values before touching the database", async () => {
    const { recordId } = await seedRecord();
    actAs(reviewer);
    expect(
      (await actions.reviewRecord({ recordId, action: "correct", fields: { status: "approved" } })).ok,
    ).toBe(false);
    expect(
      (await actions.reviewRecord({ recordId, action: "correct", fields: { issue_date: "14/10/2026" } })).ok,
    ).toBe(false);
    expect(await reviewRows(recordId)).toEqual([]);
  });
});

describe("reviewRecord — decisions", () => {
  it("approve: record approved by the reviewer, issues resolved, document ready, action recorded", async () => {
    const { recordId, documentId } = await seedRecord({ total_cents: 126057 }, [
      { code: "no_entity", severity: "warning" },
    ]);
    actAs(reviewer);
    // The stored warning is recomputed away (the record has an entity) → clean approve.
    expect(await actions.reviewRecord({ recordId, action: "approve" })).toMatchObject({
      ok: true,
      data: { status: "approved" },
    });
    expect(await recordRow(recordId)).toMatchObject({ status: "approved", approved_by: reviewer.id });
    expect((await admin.from("documents").select("status").eq("id", documentId).single()).data?.status).toBe(
      "ready",
    );
    expect((await reviewRows(recordId)).at(-1)).toMatchObject({ action: "approve", actor_id: reviewer.id });
  });

  it("approving with remaining errors needs a reason; with one, issues are resolved by the approver", async () => {
    const { recordId } = await seedRecord(); // total mismatch remains
    actAs(reviewer);
    expect(await actions.reviewRecord({ recordId, action: "approve" })).toEqual({
      ok: false,
      error: "Approving a record with errors needs a reason.",
    });
    expect((await recordRow(recordId)).status).toBe("needs_review");
    expect(
      (await actions.reviewRecord({ recordId, action: "approve", reason: "Supplier confirmed by phone" })).ok,
    ).toBe(true);
    const { data } = await admin.from("validation_issues").select("resolved_by").eq("record_id", recordId);
    expect(data?.every((i) => i.resolved_by === reviewer.id)).toBe(true);
  });

  it("reject requires a reason; a decided record must be reopened before changes", async () => {
    const { recordId, documentId } = await seedRecord();
    actAs(owner);
    expect((await actions.reviewRecord({ recordId, action: "reject" })).ok).toBe(false);
    expect(
      await actions.reviewRecord({ recordId, action: "reject", reason: "Not our invoice" }),
    ).toMatchObject({ ok: true, data: { status: "rejected" } });
    expect(await actions.reviewRecord({ recordId, action: "correct", fields: { total_cents: 1 } })).toEqual({
      ok: false,
      error: "Record was already rejected; reopen it first.",
    });
    expect(await actions.reviewRecord({ recordId, action: "reopen" })).toMatchObject({
      ok: true,
      data: { status: "needs_review" },
    });
    expect((await admin.from("documents").select("status").eq("id", documentId).single()).data?.status).toBe(
      "needs_review",
    );
    expect((await reviewRows(recordId)).map((r) => r.action)).toEqual(["reject", "reopen"]);
  });

  it("other orgs' records are invisible", async () => {
    const { recordId } = await seedRecord({}, [], otherOrgId);
    actAs(reviewer);
    expect(await actions.reviewRecord({ recordId, action: "approve", reason: "x" })).toEqual({
      ok: false,
      error: "Record not found.",
    });
    expect((await recordRow(recordId)).status).toBe("needs_review");
  });

  it("calling the database function directly with a member's session is refused", async () => {
    const { recordId } = await seedRecord();
    const { error } = await member.client.rpc("review_record", {
      p_record: recordId,
      p_action: "approve",
      p_reason: "x",
    });
    expect(error?.code).toBe("P0002");
  });
});

describe("bulkApproveClean", () => {
  it("approves only records without issues; members are refused", async () => {
    const clean = await seedRecord({ total_cents: 126057 });
    const flagged = await seedRecord({}, [{ code: "total_mismatch", severity: "error" }]);
    actAs(member);
    expect((await actions.bulkApproveClean({ recordIds: [clean.recordId] })).ok).toBe(false);
    actAs(reviewer);
    expect(await actions.bulkApproveClean({ recordIds: [clean.recordId, flagged.recordId] })).toEqual({
      ok: true,
      data: { approved: 1 },
    });
    expect((await recordRow(clean.recordId)).status).toBe("approved");
    expect((await recordRow(flagged.recordId)).status).toBe("needs_review");
    expect((await reviewRows(clean.recordId))[0]).toMatchObject({
      action: "approve",
      reason: "Bulk approval (no issues)",
      actor_id: reviewer.id,
    });
  });
});
