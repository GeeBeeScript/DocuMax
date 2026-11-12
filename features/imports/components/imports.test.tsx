import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ExportForm } from "@/features/data/components/export-form";
import type { ImportRow } from "../queries";
import { ImportHistory } from "./import-history";
import { ImportWizard } from "./import-wizard";

const createImport = vi.hoisted(() => vi.fn());
const startImport = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ createImport, startImport }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ storage: { from: () => ({ upload }) } }),
}));

const ORG = "99999999-9999-4999-8999-999999999999";
const preview = {
  importId: "11111111-1111-4111-8111-111111111111",
  headers: ["Vendor", "Date", "Amount", "Notes"],
  rows: [
    { Vendor: "Acme", Date: "2026-10-01", Amount: "10.00", Notes: "" },
    { Vendor: "", Date: "01/10/2026", Amount: "x", Notes: "" },
  ],
  rowCount: 2,
  mapping: { supplier_name: "Vendor", issue_date: "Date", total_cents: "Amount" },
};

beforeEach(() => {
  createImport.mockReset();
  startImport.mockReset();
  upload.mockReset().mockResolvedValue({ error: null });
});

async function pickFile() {
  render(<ImportWizard orgId={ORG} entities={[]} defaultCurrency="USD" canApprove />);
  const input = screen.getByLabelText("Choose a CSV file");
  fireEvent.change(input, { target: { files: [new File(["x"], "costs.csv", { type: "text/csv" })] } });
  await screen.findByText(/Match the columns of costs\.csv \(2 rows\)/);
}

describe("ImportWizard", () => {
  it("uploads to the org's imports folder, maps columns, previews problems and starts", async () => {
    createImport.mockResolvedValue({ ok: true, data: preview });
    startImport.mockResolvedValue({ ok: true });
    await pickFile();
    expect(upload.mock.calls[0]![0]).toMatch(new RegExp(`^${ORG}/imports/[0-9a-f-]{36}\\.csv$`));
    expect(createImport).toHaveBeenCalledWith({
      storagePath: upload.mock.calls[0]![0],
      fileName: "costs.csv",
    });
    expect(screen.getByLabelText("Supplier")).toHaveValue("Vendor");
    expect(screen.getByRole("status")).toHaveTextContent("1 of 2 preview rows are ready to import.");
    expect(screen.getByRole("status")).toHaveTextContent("1 row has problems");
    expect(screen.getByText(/Vendor: Supplier is required\./)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Invoice number"), { target: { value: "Notes" } });
    fireEvent.click(screen.getByLabelText("Approve rows that have no issues"));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() =>
      expect(startImport).toHaveBeenCalledWith({
        importId: preview.importId,
        mapping: { ...preview.mapping, invoice_number: "Notes" },
        approve: true,
      }),
    );
  });

  it("refuses non-CSV files and shows action errors", async () => {
    render(<ImportWizard orgId={ORG} entities={[]} defaultCurrency="USD" canApprove={false} />);
    fireEvent.change(screen.getByLabelText("Choose a CSV file"), {
      target: { files: [new File(["x"], "costs.xlsx")] },
    });
    expect(await screen.findByText("Choose a .csv file.")).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it("start errors stay on the mapping step", async () => {
    createImport.mockResolvedValue({ ok: true, data: preview });
    startImport.mockResolvedValue({ ok: false, error: "Choose a column for: Total." });
    await pickFile();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText("Choose a column for: Total.")).toBeInTheDocument();
  });
});

describe("ImportHistory / ExportForm", () => {
  it("shows results with the error report and a link to review", () => {
    const row: ImportRow = {
      id: "22222222-2222-4222-8222-222222222222",
      fileName: "costs.csv",
      status: "done",
      rowsTotal: 5,
      rowsOk: 3,
      rowsFailed: 2,
      hasErrorReport: true,
      error: null,
      createdAt: "2026-11-01T10:00:00Z",
    };
    render(<ImportHistory imports={[row]} />);
    const r = screen.getAllByRole("row")[1]!;
    expect(within(r).getByText("3 imported · 2 skipped")).toBeInTheDocument();
    expect(within(r).getByRole("link", { name: "Error report" })).toHaveAttribute(
      "href",
      `/app/data/imports/${row.id}/errors`,
    );
    expect(within(r).getByRole("link", { name: "Open in Review" })).toHaveAttribute("href", "/app/review");
  });

  it("export form targets the export route with GET", () => {
    const { container } = render(<ExportForm entityOptions={[]} entitySingular="Job" entityPlural="Jobs" />);
    const form = container.querySelector("form")!;
    expect(form).toHaveAttribute("action", "/app/exports/records");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByLabelText("Job")).toBeInTheDocument();
  });
});
