import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AllocationEditor } from "./allocation-editor";

const setAllocations = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ setAllocations }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const ELM = "11111111-1111-4111-8111-111111111111";
const OAK = "22222222-2222-4222-8222-222222222222";
const options = [
  { value: ELM, label: "12 Elm" },
  { value: OAK, label: "4 Oak" },
];
const props = {
  recordId: "33333333-3333-4333-8333-333333333333",
  totalCents: 10001,
  currency: "USD",
  homeEntityId: ELM,
  entityOptions: options,
  initial: null,
  hasLineSplits: false,
  disabled: false,
  singular: "Property",
  plural: "Properties",
};

beforeEach(() => {
  setAllocations.mockReset();
  refresh.mockReset();
});

describe("AllocationEditor", () => {
  it("shows the default (100% to the record's entity) and previews exact cents while editing", async () => {
    setAllocations.mockResolvedValue({ ok: true, data: { rows: 2 } });
    render(<AllocationEditor {...props} />);
    expect(screen.getByText("Counts 100% to 12 Elm.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Split this cost" }));

    fireEvent.change(screen.getByLabelText("Share (%), row 1"), { target: { value: "50" } });
    fireEvent.change(screen.getByLabelText("Property, row 2"), { target: { value: OAK } });
    fireEvent.change(screen.getByLabelText("Share (%), row 2"), { target: { value: "50" } });
    expect(screen.getByText("Total: 100%")).toBeInTheDocument();
    expect(screen.getByText("$50.01")).toBeInTheDocument(); // largest remainder: the leftover cent goes first
    expect(screen.getByText("$50.00")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save split" }));
    await waitFor(() =>
      expect(setAllocations).toHaveBeenCalledWith({
        recordId: props.recordId,
        method: "percent",
        splits: [
          { entityId: ELM, percentBp: 5000 },
          { entityId: OAK, percentBp: 5000 },
        ],
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("explains invalid splits and does not save them", () => {
    render(<AllocationEditor {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Split this cost" }));
    fireEvent.change(screen.getByLabelText("Share (%), row 1"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("Property, row 2"), { target: { value: OAK } });
    fireEvent.change(screen.getByLabelText("Share (%), row 2"), { target: { value: "30" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Percentages must add up to 100%.");
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));
    expect(setAllocations).not.toHaveBeenCalled();
  });

  it("by amount: the rest stays with the record's entity", () => {
    render(<AllocationEditor {...props} homeEntityId={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Split this cost" }));
    fireEvent.click(screen.getByRole("radio", { name: "By amount" }));
    fireEvent.change(screen.getByLabelText("Property, row 1"), { target: { value: OAK } });
    fireEvent.change(screen.getByLabelText("Amount, row 1"), { target: { value: "20.00" } });
    fireEvent.click(screen.getByRole("button", { name: "Remove row 2" }));
    expect(screen.getByText("Rest stays unassigned")).toBeInTheDocument();
    expect(screen.getByText("$80.01")).toBeInTheDocument();
  });

  it("summarizes an existing split and can remove it; read-only without the role", async () => {
    setAllocations.mockResolvedValue({ ok: true, data: { rows: 0 } });
    const initial = {
      method: "percent" as const,
      rows: [
        { entityId: ELM, percentBp: 6000, amountCents: null },
        { entityId: OAK, percentBp: 4000, amountCents: null },
      ],
    };
    const { unmount } = render(<AllocationEditor {...props} initial={initial} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit split" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove split" }));
    await waitFor(() => expect(setAllocations).toHaveBeenCalledWith(expect.objectContaining({ splits: [] })));
    unmount();
    render(
      <AllocationEditor
        {...props}
        initial={initial}
        disabled
        disabledReason="Only reviewers can change splits."
      />,
    );
    expect(screen.queryByRole("button", { name: "Edit split" })).toBeNull();
    expect(screen.getByText("Only reviewers can change splits.")).toBeInTheDocument();
  });
});
