import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IssueBanner } from "@/components/app/issue-banner";
import { buildContext } from "@/lib/validation/test-builders";
import type { Database } from "@/lib/supabase/database.types";
import { shortcutFor } from "../hooks/use-review-shortcuts";
import { ReviewWorkspace, type ReviewNav } from "./review-workspace";
import { IssueChips } from "./issue-chips";

const reviewRecord = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ reviewRecord, bulkApproveClean: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type RecordRow = Database["public"]["Tables"]["records"]["Row"];
type LineItemRow = Database["public"]["Tables"]["line_items"]["Row"];

const ENTITY = "22222222-2222-4222-8222-222222222222";
const baseRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  org_id: "o",
  document_id: "d",
  extraction_id: null,
  document_type: "invoice",
  supplier_name: "ACME Plumbing",
  supplier_tax_id: null,
  invoice_number: "INV-42",
  issue_date: "2026-10-14",
  due_date: null,
  currency: "USD",
  subtotal_cents: 116450,
  tax_cents: 9607,
  tax_rate: null,
  total_cents: 126057,
  category: null,
  entity_hint: null,
  entity_id: ENTITY,
  min_confidence: 0.95,
  field_confidence: {
    supplier_name: 0.97,
    issue_date: 0.97,
    total_cents: 0.95,
    currency: 0.95,
    invoice_number: 0.97,
  },
  status: "needs_review",
  approved_by: null,
  approved_at: null,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
} as unknown as RecordRow;
const nav: ReviewNav = {
  queueHref: "/app/review",
  prevHref: null,
  nextHref: "/app/review/next-id",
  position: 1,
  queueSize: 2,
};

function renderWorkspace(
  overrides: Partial<RecordRow> = {},
  props: { canReview?: boolean; lines?: LineItemRow[] } = {},
) {
  return render(
    <ReviewWorkspace
      record={{ ...baseRecord, ...overrides }}
      lineItems={props.lines ?? []}
      context={buildContext()}
      entityOptions={[{ value: ENTITY, label: "Elm St" }]}
      entitySingular="Property"
      canReview={props.canReview ?? true}
      approverName={null}
      nav={nav}
      preview={<p>preview</p>}
      history={<p>history</p>}
    />,
  );
}
const key = (k: string, target: EventTarget = document.body) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  });

beforeEach(() => {
  reviewRecord.mockReset();
  push.mockReset();
  refresh.mockReset();
});

describe("IssueBanner / IssueChips", () => {
  it("announces severity and renders actions", () => {
    render(
      <IssueBanner
        severity="error"
        title="Total doesn't add up"
        message="Off by 0.42"
        actions={<button>Go</button>}
      />,
    );
    expect(screen.getByText("Error:")).toHaveClass("sr-only");
    expect(screen.getByText("Off by 0.42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go" })).toBeInTheDocument();
  });

  it("chips show each code once, or 'No issues'", () => {
    const { rerender } = render(
      <IssueChips
        issues={[
          { code: "line_math", severity: "error" },
          { code: "line_math", severity: "error" },
          { code: "no_entity", severity: "warning" },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    rerender(<IssueChips issues={[]} />);
    expect(screen.getByText("No issues")).toBeInTheDocument();
  });
});

describe("ReviewWorkspace", () => {
  it("a clean record is approved with one keystroke and moves to the next item", async () => {
    reviewRecord.mockResolvedValue({ ok: true, data: { status: "approved", issues: [] } });
    renderWorkspace();
    expect(screen.getByText("No issues — ready to approve.")).toBeInTheDocument();
    key("a");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/app/review/next-id"));
    expect(reviewRecord).toHaveBeenCalledWith({
      recordId: baseRecord.id,
      action: "approve",
      reason: undefined,
    });
  });

  it("re-validates live: fixing the total clears the banner and sends only the change", async () => {
    reviewRecord.mockResolvedValue({ ok: true, data: { status: "needs_review", issues: [] } });
    renderWorkspace({ total_cents: 126099 });
    expect(screen.getByText("Total doesn't add up")).toBeInTheDocument();
    const total = screen.getByLabelText("Total");
    expect(total).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(total, { target: { value: "1,260.57" } });
    expect(screen.queryByText("Total doesn't add up")).toBeNull();
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save corrections" }));
    await waitFor(() =>
      expect(reviewRecord).toHaveBeenCalledWith({
        recordId: baseRecord.id,
        action: "correct",
        fields: { total_cents: 126057 },
        lines: undefined,
        reason: undefined,
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("approving with errors asks for a reason first", async () => {
    reviewRecord.mockResolvedValue({ ok: true, data: { status: "approved", issues: [] } });
    renderWorkspace({ total_cents: 126099 });
    key("a");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Approve with errors?")).toBeInTheDocument();
    expect(reviewRecord).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve anyway" }));
    expect(await within(dialog).findByText("Give a reason.")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Reason"), { target: { value: "Supplier confirmed" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Approve anyway" }));
    await waitFor(() =>
      expect(reviewRecord).toHaveBeenCalledWith(
        expect.objectContaining({ action: "approve", reason: "Supplier confirmed" }),
      ),
    );
  });

  it("R opens the reject dialog; shortcuts are ignored while typing", async () => {
    renderWorkspace();
    key("r", screen.getByLabelText("Supplier"));
    expect(screen.queryByRole("dialog")).toBeNull();
    key("r");
    expect(await screen.findByRole("dialog")).toHaveTextContent("Reject this record?");
  });

  it("unparseable input blocks saving and is shown on the field", () => {
    renderWorkspace();
    fireEvent.change(screen.getByLabelText("Total"), { target: { value: "12.34.56" } });
    expect(screen.getByText("Enter an amount like 1,260.57")).toBeInTheDocument();
    key("a");
    expect(reviewRecord).not.toHaveBeenCalled();
  });

  it("read-only roles see the record without decisions", () => {
    renderWorkspace({}, { canReview: false });
    expect(screen.getByText(/only reviewers can approve/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Approve/ })).toBeNull();
    expect(screen.getByLabelText("Total")).toBeDisabled();
  });

  it("decided records offer Reopen instead of decisions", async () => {
    reviewRecord.mockResolvedValue({ ok: true, data: { status: "needs_review", issues: [] } });
    renderWorkspace({ status: "approved", approved_at: "2026-11-02T10:00:00Z" } as Partial<RecordRow>);
    expect(screen.getByText(/Approved automatically/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reopen" }));
    await waitFor(() =>
      expect(reviewRecord).toHaveBeenCalledWith(expect.objectContaining({ action: "reopen" })),
    );
  });

  it("line items can be edited and line math issues point at the cell", () => {
    renderWorkspace(
      { subtotal_cents: 42000, tax_cents: 0, total_cents: 42000 },
      {
        lines: [
          {
            id: "l1",
            org_id: "o",
            record_id: baseRecord.id,
            position: 1,
            description: "Valve",
            quantity: 2,
            unit_price_cents: 21000,
            amount_cents: 42000,
            category: null,
            confidence: 1,
            created_at: "",
            updated_at: "",
          } as unknown as LineItemRow,
        ],
      },
    );
    const amount = screen.getByLabelText("Amount, line 1");
    fireEvent.change(amount, { target: { value: "430.00" } });
    expect(screen.getByText("Line math is off")).toBeInTheDocument();
    expect(amount).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Add line" }));
    expect(screen.getByLabelText("Description, line 2")).toBeInTheDocument();
  });
});

describe("shortcutFor", () => {
  const ev = (
    key: string,
    extra: Partial<KeyboardEvent> = {},
    target: EventTarget | null = document.body,
  ) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    target,
    ...extra,
  });
  it("maps letters outside fields only, never on key repeat", () => {
    const input = document.createElement("input");
    expect(shortcutFor(ev("a"))).toBe("approve");
    expect(shortcutFor(ev("J"))).toBe("next");
    expect(shortcutFor(ev("a", {}, input))).toBeNull();
    expect(shortcutFor(ev("a", { repeat: true }))).toBeNull();
    expect(shortcutFor(ev("Escape", {}, input))).toBe("leave-field");
    expect(shortcutFor(ev("s", { ctrlKey: true }, input))).toBe("save");
    expect(shortcutFor(ev("a", { metaKey: true }))).toBeNull();
  });
});
