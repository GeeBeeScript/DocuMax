import { randomUUID } from "node:crypto";
import Papa from "papaparse";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { entityLabels } from "@/lib/entities/labels";
import { recordColumns } from "@/lib/export/columns";
import { toCsv } from "@/lib/export/csv";
import { loadExportData } from "@/lib/export/load";
import { importCsvJob } from "@/worker/processors/import-csv";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs, enqueued, resetEnqueued } from "../next-mocks";

const actions = await import("@/features/imports/actions");
const admin = adminClient();
let owner: TestUser, member: TestUser, reviewer: TestUser, otherOwner: TestUser;
let orgId: string, otherOrgId: string;

const CSV = [
  "Supplier,Invoice number,Issue date,Total,Tax,Category,Property",
  'Brightline Plumbing,INV-1,2026-10-14,"1,260.57",96.07,Repairs & maintenance,12 Elm',
  "Green Thumb,GT-1,2026-10-03,450.00,0,landscaping,",
  ",X-1,2026-10-05,10.00,,,", // no supplier
  "City Water,W-1,14/10/2026,abc,,Snacks,Nowhere", // four problems
  "Brightline Plumbing,INV-1,2026-10-15,1.00,0,,12 Elm", // duplicate of row 2 (same supplier + invoice)
].join("\n");

async function upload(user: TestUser, org: string, text: string) {
  const path = `${org}/imports/${randomUUID()}.csv`;
  const { error } = await user.client.storage
    .from("imports")
    .upload(path, new Blob([text], { type: "text/csv" }));
  if (error) throw error;
  return path;
}
async function runImport(user: TestUser, org: string, text: string, approve = false) {
  actAs(user);
  const created = await actions.createImport({
    storagePath: await upload(user, org, text),
    fileName: "costs.csv",
  });
  if (!created.ok) throw new Error(created.error);
  const started = await actions.startImport({
    importId: created.data.importId,
    mapping: created.data.mapping,
    approve,
  });
  if (!started.ok) throw new Error(started.error);
  const result = await importCsvJob({ orgId: org, importId: created.data.importId }, { db: admin });
  const row = (await admin.from("imports").select("*").eq("id", created.data.importId).single()).data!;
  return { created: created.data, result, row };
}

beforeAll(async () => {
  [owner, member, reviewer, otherOwner] = await Promise.all(
    ["im-owner", "im-member", "im-rev", "im-other"].map(createUser),
  );
  orgId = (await createOrg(owner, "Import Org")).id;
  otherOrgId = (await createOrg(otherOwner, "Round-trip Org")).id;
  await addMember(orgId, member, "member");
  await addMember(orgId, reviewer, "reviewer");
  await admin.from("entities").insert([
    { org_id: orgId, kind: "property", name: "12 Elm", code: "ELM" },
    { org_id: otherOrgId, kind: "property", name: "12 Elm", code: "ELM" },
  ]);
});
afterAll(async () => {
  for (const org of [orgId, otherOrgId]) {
    const { data } = await admin.storage.from("imports").list(`${org}/imports`);
    if (data?.length) await admin.storage.from("imports").remove(data.map((f) => `${org}/imports/${f.name}`));
  }
  await cleanup([orgId, otherOrgId], [owner, member, reviewer, otherOwner]);
});
beforeEach(() => resetEnqueued());

describe("CSV import", () => {
  it("previews with a suggested mapping, then imports only valid rows with a row/column/message error report", async () => {
    const { created, result, row } = await runImport(member, orgId, CSV);
    expect(created.headers).toEqual([
      "Supplier",
      "Invoice number",
      "Issue date",
      "Total",
      "Tax",
      "Category",
      "Property",
    ]);
    expect(created.rowCount).toBe(5);
    expect(created.mapping).toMatchObject({
      supplier_name: "Supplier",
      total_cents: "Total",
      entity: "Property",
    });
    expect(enqueued()).toEqual([
      {
        queue: "import-csv",
        payload: { orgId, importId: created.importId },
        jobId: `import-${created.importId}`,
      },
    ]);
    expect(result).toEqual({ outcome: "done", ok: 3, failed: 2 });
    expect(row).toMatchObject({ status: "done", rows_total: 5, rows_ok: 3, rows_failed: 2 });

    const { data: report } = await admin.storage.from("imports").download(row.error_report_path!);
    const lines = Papa.parse<string[]>(await report!.text(), { skipEmptyLines: true }).data;
    expect(lines).toEqual([
      ["Row", "Column", "Message"],
      ["4", "Supplier", "Supplier is required."],
      ["5", "Total", '"abc" isn\'t an amount like 1260.57.'],
      ["5", "Issue date", '"14/10/2026" isn\'t a date like 2026-10-14.'],
      ["5", "Category", 'Unknown category "Snacks".'],
      ["5", "Property", 'No property or job matches "Nowhere".'],
    ]);
  });

  it("imported records go to review with validation issues and are audited as the importer", async () => {
    const { created } = await runImport(member, orgId, CSV.replace(/INV-1/g, "INV-2"));
    const { data: records } = await admin
      .from("records")
      .select(
        "id, supplier_name, total_cents, tax_cents, entity_id, status, source, document_id, field_confidence",
      )
      .eq("import_id", created.importId)
      .order("created_at");
    expect(records).toHaveLength(3);
    expect(records![0]).toMatchObject({
      supplier_name: "Brightline Plumbing",
      total_cents: 126057,
      tax_cents: 9607,
      source: "import",
      document_id: null,
      status: "needs_review",
    });
    expect((records![0]!.field_confidence as Record<string, number>).total_cents).toBe(1);
    const codes = async (id: string) =>
      ((await admin.from("validation_issues").select("code").eq("record_id", id)).data ?? [])
        .map((i) => i.code)
        .sort();
    expect(await codes(records![0]!.id)).toEqual(["duplicate"]); // same supplier + invoice as another row of the file
    expect(await codes(records![1]!.id)).toEqual(["duplicate", "no_entity"]); // GT-1 was imported by the first test
    const { data: audit } = await admin
      .from("audit_log")
      .select("actor_id")
      .eq("table_name", "records")
      .eq("row_id", records![1]!.id)
      .eq("action", "insert")
      .single();
    expect(audit?.actor_id).toBe(member.id);
  });

  it("approve on import: reviewers only; issue-free rows are approved with a review action", async () => {
    actAs(member);
    const created = await actions.createImport({
      storagePath: await upload(member, orgId, CSV),
      fileName: "a.csv",
    });
    expect(
      created.ok &&
        (
          await actions.startImport({
            importId: created.data.importId,
            mapping: created.data.mapping,
            approve: true,
          })
        ).ok,
    ).toBe(false);

    const clean =
      "Supplier,Invoice number,Issue date,Total,Tax,Property\nNew Supplier,N-1,2026-10-01,100.00,0,12 Elm\n";
    const { created: c2 } = await runImport(reviewer, orgId, clean, true);
    const { data: rec } = await admin
      .from("records")
      .select("id, status, approved_by")
      .eq("import_id", c2.importId)
      .single();
    expect(rec).toMatchObject({ status: "approved", approved_by: reviewer.id });
    const { data: action } = await admin
      .from("review_actions")
      .select("action, actor_id, reason")
      .eq("record_id", rec!.id)
      .single();
    expect(action).toEqual({
      action: "approve",
      actor_id: reviewer.id,
      reason: "Approved on import (no issues found)",
    });
  });

  it("refuses foreign paths, unmapped required fields, and restarting", async () => {
    actAs(member);
    expect(
      (
        await actions.createImport({
          storagePath: `${otherOrgId}/imports/${randomUUID()}.csv`,
          fileName: "x.csv",
        })
      ).ok,
    ).toBe(false);
    const created = await actions.createImport({
      storagePath: await upload(member, orgId, CSV),
      fileName: "b.csv",
    });
    if (!created.ok) throw new Error(created.error);
    expect(
      await actions.startImport({
        importId: created.data.importId,
        mapping: { ...created.data.mapping, total_cents: null },
      }),
    ).toEqual({
      ok: false,
      error: "Choose a column for: Total.",
    });
    expect(
      (await actions.startImport({ importId: created.data.importId, mapping: created.data.mapping })).ok,
    ).toBe(true);
    expect(
      await actions.startImport({ importId: created.data.importId, mapping: created.data.mapping }),
    ).toEqual({
      ok: false,
      error: "This import has already started.",
    });
  });
});

describe("export → import round trip", () => {
  it("re-imports exported records without data loss", async () => {
    const elm = (await admin.from("entities").select("id").eq("org_id", orgId).eq("code", "ELM").single())
      .data!.id;
    const fields = {
      document_type: "credit_note" as const,
      supplier_name: "=Formula Supplies, Inc.",
      supplier_tax_id: "47-2291034",
      invoice_number: "-CN-7",
      issue_date: "2026-09-02",
      due_date: "2026-10-02",
      currency: "EUR",
      subtotal_cents: -10000,
      tax_cents: -825,
      tax_rate: 8.25,
      total_cents: -10825,
      category: "professional_services" as const,
    };
    await admin.from("records").insert({
      org_id: orgId,
      ...fields,
      entity_id: elm,
      status: "approved",
      min_confidence: 1,
      field_confidence: {},
    });

    actAs(owner);
    const { records } = await loadExportData(owner.client, orgId, {
      status: "approved",
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(records).toHaveLength(1);
    const csv = toCsv(recordColumns(entityLabels("property")), records);

    const { row, created } = await runImport(otherOwner, otherOrgId, `﻿${csv}`);
    expect(row).toMatchObject({ rows_ok: 1, rows_failed: 0 });
    const { data: copy } = await admin
      .from("records")
      .select(
        "document_type, supplier_name, supplier_tax_id, invoice_number, issue_date, due_date, currency, subtotal_cents, tax_cents, tax_rate, total_cents, category, entity:entities(name, code)",
      )
      .eq("import_id", created.importId)
      .single();
    expect(copy).toEqual({ ...fields, entity: { name: "12 Elm", code: "ELM" } });
  });
});
