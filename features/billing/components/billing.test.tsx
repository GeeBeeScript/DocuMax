import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UsageMeter } from "@/components/app/usage-meter";
import { UploadPanel } from "@/features/documents/components/upload-panel";
import { OverLimitDialog } from "./over-limit-dialog";
import { PlanPicker } from "./plan-picker";

const add = vi.hoisted(() => vi.fn());
const startCheckout = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/documents/hooks/use-upload-queue", () => ({
  useUploadQueue: () => ({ items: [], add, clearFinished: vi.fn() }),
}));
vi.mock("../actions", () => ({ startCheckout, openBillingPortal: vi.fn() }));

beforeEach(() => {
  add.mockReset();
  startCheckout.mockReset();
});

describe("UsageMeter", () => {
  it("exposes the value and turns red at the cap", () => {
    const { rerender } = render(
      <UsageMeter used={12} cap={25} label="12 of 25 documents used" caption="12 of 25" />,
    );
    const meter = screen.getByRole("meter", { name: "12 of 25 documents used" });
    expect(meter).toHaveAttribute("aria-valuenow", "12");
    expect(meter).toHaveAttribute("aria-valuemax", "25");
    expect(meter.firstElementChild).toHaveClass("bg-ink");
    rerender(<UsageMeter used={21} cap={25} label="x" caption="21 of 25" />);
    expect(screen.getByRole("meter").firstElementChild).toHaveClass("bg-yellow-hover");
    rerender(<UsageMeter used={25} cap={25} label="x" caption="25 of 25" />);
    expect(screen.getByRole("meter").firstElementChild).toHaveClass("bg-danger");
    expect(screen.getByText("25 of 25")).toHaveClass("text-danger");
  });
});

describe("OverLimitDialog", () => {
  it("owners get the plans link; others are told to ask an owner", () => {
    const { rerender } = render(
      <OverLimitDialog open onOpenChange={vi.fn()} planName="Free" cap={25} remaining={0} canManageBilling />,
    );
    expect(
      screen.getByText("The Free plan includes 25 documents a month, and they're used up."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute("href", "/app/settings/billing");
    rerender(
      <OverLimitDialog
        open
        onOpenChange={vi.fn()}
        planName="Free"
        cap={25}
        remaining={0}
        canManageBilling={false}
      />,
    );
    expect(screen.queryByRole("link", { name: "See plans" })).toBeNull();
    expect(screen.getByText("Ask an owner of your organization to upgrade.")).toBeInTheDocument();
  });
});

describe("UploadPanel with a cap", () => {
  it("dropping more files than fit asks first, then uploads only what fits", async () => {
    const { container } = render(
      <UploadPanel
        entityOptions={[]}
        entitySingular="Property"
        quota={{ remaining: 2, cap: 25, planName: "Free", canManageBilling: true }}
      />,
    );
    const files = ["a.pdf", "b.pdf", "c.pdf"].map((n) => new File(["x"], n, { type: "application/pdf" }));
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files } });
    expect(await screen.findByText("Only 2 more documents fit this month.")).toBeInTheDocument();
    expect(add).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Upload the first 2" }));
    expect(add).toHaveBeenCalledWith(files.slice(0, 2), undefined);
  });

  it("uploads straight away when everything fits (or there's no cap)", () => {
    const { container } = render(
      <UploadPanel
        entityOptions={[]}
        entitySingular="Property"
        quota={{ remaining: null, cap: null, planName: "Enterprise", canManageBilling: false }}
      />,
    );
    const files = [new File(["x"], "a.pdf", { type: "application/pdf" })];
    fireEvent.change(container.querySelector("input[type=file]")!, { target: { files } });
    expect(add).toHaveBeenCalledWith(files, undefined);
  });
});

describe("PlanPicker", () => {
  it("owners upgrade with the chosen interval; non-owners see no buttons", async () => {
    startCheckout.mockResolvedValue({ ok: false, error: "Billing isn't set up yet." });
    const { rerender } = render(<PlanPicker current="free" canManage />);
    expect(screen.getByText("Your plan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Yearly" }));
    fireEvent.click(screen.getByRole("button", { name: "Upgrade to Business" }));
    await waitFor(() => expect(startCheckout).toHaveBeenCalledWith({ plan: "business", interval: "yearly" }));
    rerender(<PlanPicker current="free" canManage={false} />);
    expect(screen.queryByRole("button", { name: /Upgrade/ })).toBeNull();
  });
});
