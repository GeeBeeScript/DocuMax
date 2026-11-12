import { unzipSync } from "fflate";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { monthPeriod } from "@/lib/calc/period";
import { statementFileName } from "@/lib/reports/file-names";
import type { RenderedReport } from "@/pdf/document";
import { batchZipJob } from "@/worker/processors/batch-zip";
import { renderReportJob } from "@/worker/processors/render-report";
import { addMember, adminClient, cleanup, createOrg, createUser, type TestUser } from "../helpers";
import { actAs, enqueued, resetEnqueued } from "../next-mocks";

const actions = await import("@/features/reports/actions");
const admin = adminClient();
const october = monthPeriod("2026-10");
let owner: TestUser, member: TestUser;
let orgId: string, elm: string;

/** Fake Chromium: keeps what it was asked to render; returns a tiny "PDF". */
const rendered: RenderedReport[] = [];
const zipped: string[] = [];
const deps = () => ({
  db: admin,
  render: async (r: RenderedReport) => {
    rendered.push(r);
    return new TextEncoder().encode(`%PDF-1.4 fake ${r.pageCount} page(s)`);
  },
  enqueueZip: async ({ batchId }: { orgId: string; batchId: string }) => {
    zipped.push(batchId);
  },
  now: () => new Date("2026-11-01T12:00:00Z"),
});
const report = async (id: string) => (await admin.from("reports").select("*").eq("id", id).single()).data!;

beforeAll(async () => {
  [owner, member] = await Promise.all(["rr-owner", "rr-member"].map(createUser));
  orgId = (await createOrg(owner, "Reports Org")).id;
  await addMember(orgId, member, "member");
  await admin
    .from("organizations")
    .update({ footer_text: "Reports Org · 1 Main St", brand_color: "#2f6fff" })
    .eq("id", orgId);
  elm = (
    await admin
      .from("entities")
      .insert({ org_id: orgId, kind: "property", name: "12 Elm" })
      .select("id")
      .single()
  ).data!.id;
  await admin.from("records").insert(
    [126057, 45000].map((total, i) => ({
      org_id: orgId,
      document_type: "invoice" as const,
      supplier_name: `Supplier ${i}`,
      issue_date: `2026-10-1${i}`,
      currency: "USD",
      tax_cents: 0,
      total_cents: total,
      entity_id: elm,
      min_confidence: 1,
      field_confidence: {},
      status: "approved" as const,
    })),
  );
});
afterAll(async () => {
  const { data } = await admin.storage.from("reports").list(`${orgId}/reports`, { limit: 1000 });
  if (data?.length) await admin.storage.from("reports").remove(data.map((f) => `${orgId}/reports/${f.name}`));
  await admin.storage.from("reports").remove([`${orgId}/batches`]);
  await cleanup([orgId], [owner, member]);
});
beforeEach(() => {
  rendered.length = 0;
  zipped.length = 0;
  resetEnqueued();
});

describe("generating reports", () => {
  it("members can't generate; reviewers+ queue a render job", async () => {
    actAs(member);
    expect((await actions.generateStatement({ entityId: elm, period: october })).ok).toBe(false);
    actAs(owner);
    const res = await actions.generateStatement({ entityId: elm, period: october });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.data.id : "";
    expect(enqueued()).toEqual([
      { queue: "render-report", payload: { orgId, reportId: id }, jobId: `report-${id}` },
    ]);
    expect(await report(id)).toMatchObject({
      status: "queued",
      kind: "statement",
      file_name: "Statement - 12 Elm - 2026-10.pdf",
    });
  });

  it("a statement renders from lib/calc figures and is stored; a second run is skipped", async () => {
    actAs(owner);
    const res = await actions.generateStatement({ entityId: elm, period: october });
    const id = res.ok ? res.data.id : "";
    expect(await renderReportJob({ orgId, reportId: id }, deps())).toEqual({ outcome: "done" });
    const row = await report(id);
    expect(row).toMatchObject({
      status: "ready",
      storage_path: `${orgId}/reports/${id}.pdf`,
      page_count: 1,
      attempts: 1,
    });
    expect(rendered[0]!.html).toContain("12 Elm");
    expect(rendered[0]!.html).toContain("$1,710.57"); // 1,260.57 + 450.00
    expect(rendered[0]!.headerTemplate).toContain("Reports Org");
    expect(rendered[0]!.headerTemplate).toContain("#2f6fff");
    expect(rendered[0]!.footerTemplate).toContain("Reports Org · 1 Main St");
    expect(rendered[0]!.footerTemplate).toContain("Generated Nov 1, 2026");
    const { data } = await admin.storage.from("reports").download(row.storage_path!);
    expect(await data!.text()).toBe("%PDF-1.4 fake 1 page(s)");
    expect(await renderReportJob({ orgId, reportId: id }, deps())).toEqual({ outcome: "skipped" });
  });

  it("quotes get sequential numbers and price the job's costs", async () => {
    actAs(owner);
    const year = new Date().getFullYear();
    const q1 = await actions.generateQuote({
      entityId: elm,
      period: october,
      markupBp: 2000,
      taxRateBp: 1000,
      validDays: 30,
      notes: "Thanks!",
    });
    const q2 = await actions.generateQuote({
      entityId: elm,
      period: october,
      markupBp: 0,
      taxRateBp: 0,
      validDays: 30,
    });
    expect(q1.ok && q1.data.number).toBe(`Q-${year}-0001`);
    expect(q2.ok && q2.data.number).toBe(`Q-${year}-0002`);
    const id = q1.ok ? q1.data.id : "";
    expect((await report(id)).file_name).toBe(`Quote Q-${year}-0001 - 12 Elm.pdf`);
    await renderReportJob({ orgId, reportId: id }, deps());
    // (1,710.57 × 1.2) × 1.1 = 2,052.68 + 205.27 = 2,257.95 (markup per line, rounded half away from zero)
    expect(rendered[0]!.html).toContain("$2,257.95");
    expect(rendered[0]!.html).toContain("Thanks!");
    expect(rendered[0]!.html).not.toContain("$1,260.57"); // costs are never printed on a quote
  });

  it("a summary covers every entity; a deleted entity fails the statement permanently", async () => {
    actAs(owner);
    const s = await actions.generateSummary({ period: october });
    await renderReportJob({ orgId, reportId: s.ok ? s.data.id : "" }, deps());
    expect(rendered[0]!.html).toContain("12 Elm");

    const gone = (
      await admin
        .from("entities")
        .insert({ org_id: orgId, kind: "property", name: "Gone" })
        .select("id")
        .single()
    ).data!.id;
    const r = await actions.generateStatement({ entityId: gone, period: october });
    await admin.from("entities").delete().eq("id", gone);
    const id = r.ok ? r.data.id : "";
    expect(await renderReportJob({ orgId, reportId: id }, deps())).toEqual({ outcome: "failed" });
    expect(await report(id)).toMatchObject({ status: "failed", error: "The property no longer exists." });
  });

  it("rejects invalid input before touching the database", async () => {
    actAs(owner);
    expect(
      (await actions.generateStatement({ entityId: elm, period: { start: "2026-10-31", end: "2026-10-01" } }))
        .ok,
    ).toBe(false);
    expect(
      (
        await actions.generateQuote({
          entityId: elm,
          period: october,
          markupBp: -1,
          taxRateBp: 0,
          validDays: 30,
        })
      ).ok,
    ).toBe(false);
    expect(enqueued()).toEqual([]);
  });
});

describe("statement batches", () => {
  it("50 properties → 50 reports → one ZIP with 50 correctly named PDFs", async () => {
    const names = Array.from({ length: 50 }, (_, i) => `Unit ${String(i + 1).padStart(2, "0")}`);
    await admin
      .from("entities")
      .insert(names.map((name) => ({ org_id: orgId, kind: "property" as const, name })));
    actAs(owner);
    const res = await actions.generateStatementBatch({ period: october });
    expect(res.ok).toBe(true);
    const batchId = res.ok ? res.data.batchId : "";
    const { data: active } = await admin
      .from("entities")
      .select("name")
      .eq("org_id", orgId)
      .eq("status", "active");
    expect(res.ok && res.data.total).toBe(active!.length); // every active entity (50 units + 12 Elm)
    expect(enqueued()).toHaveLength(active!.length);

    for (const job of enqueued()) {
      await renderReportJob(job.payload as { orgId: string; reportId: string }, deps());
    }
    expect(zipped).toEqual([batchId]); // enqueued exactly once, after the last report
    expect((await admin.from("report_batches").select("*").eq("id", batchId).single()).data).toMatchObject({
      status: "zipping",
      completed: active!.length,
      failed: 0,
    });

    const result = await batchZipJob({ orgId, batchId }, { db: admin });
    expect(result.outcome).toBe("done");
    const batch = (await admin.from("report_batches").select("*").eq("id", batchId).single()).data!;
    expect(batch).toMatchObject({ status: "ready", zip_path: `${orgId}/batches/${batchId}.zip` });
    const { data: zip } = await admin.storage.from("reports").download(batch.zip_path!);
    const files = unzipSync(new Uint8Array(await zip!.arrayBuffer()));
    const expected = active!.map((e) => statementFileName(e.name, october)).sort();
    expect(Object.keys(files).sort()).toEqual(expected);
    expect(Object.keys(files)).toContain("Statement - Unit 50 - 2026-10.pdf");
    expect(new TextDecoder().decode(files["Statement - Unit 01 - 2026-10.pdf"]!)).toMatch(/^%PDF/);
    expect(await batchZipJob({ orgId, batchId }, { db: admin })).toEqual({ outcome: "skipped" });
  });
});
