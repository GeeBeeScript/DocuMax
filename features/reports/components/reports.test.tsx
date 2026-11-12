import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { BatchRow, ReportRow } from "../queries";
import { EntityReportActions, MonthReportButton } from "./generate-dialogs";
import { BatchList, ReportList } from "./report-list";

const actions = vi.hoisted(() => ({
  generateStatement: vi.fn(),
  generateSummary: vi.fn(),
  generateQuote: vi.fn(),
  generateStatementBatch: vi.fn(),
}));
vi.mock("../actions", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const report = (over: Partial<ReportRow>): ReportRow => ({
  id: "11111111-1111-4111-8111-111111111111",
  kind: "statement",
  fileName: "Statement - 12 Elm - 2026-10.pdf",
  periodStart: "2026-10-01",
  periodEnd: "2026-10-31",
  status: "ready",
  error: null,
  pageCount: 2,
  entityName: "12 Elm",
  batchId: null,
  createdAt: "2026-11-01T10:00:00Z",
  ...over,
});

beforeEach(() => Object.values(actions).forEach((a) => a.mockReset()));

describe("ReportList / BatchList", () => {
  it("shows status and a download link only for ready reports; failures show their error", () => {
    render(
      <ReportList
        reports={[
          report({}),
          report({ id: "2", fileName: "Summary - 2026-10.pdf", kind: "summary", status: "rendering" }),
          report({
            id: "3",
            fileName: "Statement - Gone.pdf",
            status: "failed",
            error: "The property no longer exists.",
          }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).getByRole("link", { name: /Download Statement - 12 Elm/ })).toHaveAttribute(
      "href",
      "/app/reports/11111111-1111-4111-8111-111111111111/download",
    );
    expect(within(rows[2]!).getByText("Generating")).toBeInTheDocument();
    expect(within(rows[2]!).queryByRole("link")).toBeNull();
    expect(within(rows[3]!).getByText("The property no longer exists.")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("October 2026")).toBeInTheDocument();
  });

  it("batches show progress, failures and the ZIP when ready", () => {
    const batch = (over: Partial<BatchRow>): BatchRow => ({
      id: "b1",
      periodStart: "2026-10-01",
      periodEnd: "2026-10-31",
      status: "running",
      total: 50,
      completed: 20,
      failed: 1,
      error: null,
      createdAt: "",
      ...over,
    });
    const { rerender } = render(<BatchList batches={[batch({})]} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "21");
    expect(screen.getByText("20 of 50 statements")).toBeInTheDocument();
    expect(screen.getByText("1 failed")).toBeInTheDocument();
    rerender(<BatchList batches={[batch({ status: "ready", completed: 49 })]} />);
    expect(screen.getByRole("link", { name: /Download ZIP/ })).toHaveAttribute(
      "href",
      "/app/reports/batches/b1/download",
    );
  });
});

describe("generate dialogs", () => {
  it("batch: picks a month and calls the action with its period", async () => {
    actions.generateStatementBatch.mockResolvedValue({ ok: true, data: { batchId: "b", total: 3 } });
    render(<MonthReportButton kind="batch" defaultMonth="2026-10" plural="Properties" />);
    fireEvent.click(screen.getByRole("button", { name: "Statements for all properties" }));
    fireEvent.change(screen.getByLabelText("Month"), { target: { value: "2026-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(actions.generateStatementBatch).toHaveBeenCalledWith({
        period: { start: "2026-09-01", end: "2026-09-30" },
      }),
    );
  });

  it("quote: converts percentages to basis points and shows action errors", async () => {
    actions.generateQuote.mockResolvedValue({ ok: false, error: "Not found." });
    render(
      <EntityReportActions
        entityId="22222222-2222-4222-8222-222222222222"
        entityName="Deck build"
        period={{ start: "2026-10-01", end: "2026-10-31" }}
        quotes
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Create quote" }));
    fireEvent.change(screen.getByLabelText("Markup (%)"), { target: { value: "12.5" } });
    fireEvent.change(screen.getByLabelText("Sales tax (%)"), { target: { value: "8.25" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(actions.generateQuote).toHaveBeenCalledWith(
        expect.objectContaining({
          markupBp: 1250,
          taxRateBp: 825,
          validDays: 30,
          period: { start: "2026-10-01", end: "2026-10-31" },
        }),
      ),
    );
    expect(await screen.findByText("Not found.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sales tax (%)"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(await screen.findAllByText("Enter a percentage like 15 or 8.25")).not.toHaveLength(0);
    expect(actions.generateQuote).toHaveBeenCalledTimes(1);
  });

  it("statement only (no quote button) for property managers", () => {
    render(
      <EntityReportActions
        entityId="e"
        entityName="12 Elm"
        period={{ start: "2026-10-01", end: "2026-10-31" }}
        quotes={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Generate statement" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create quote" })).toBeNull();
  });
});
