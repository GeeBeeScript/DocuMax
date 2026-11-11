import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { entityLabels } from "@/lib/entities/labels";
import type { EntitySummary } from "../queries";
import { EntityCollection } from "./entity-collection";
import { EntityDialog } from "./entity-dialog";

const createEntity = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ createEntity, updateEntity: vi.fn(), setEntityStatus: vi.fn() }));

const labels = entityLabels("job");
const entities: EntitySummary[] = [
  {
    id: "1",
    name: "Kitchen remodel",
    code: "J-1",
    address: "1 Bay Rd",
    clientName: "M. Chen",
    status: "active",
    documentCount: 4,
  },
  {
    id: "2",
    name: "Roof repair",
    code: null,
    address: null,
    clientName: null,
    status: "active",
    documentCount: 0,
  },
];

describe("EntityCollection", () => {
  it("grid view renders a card per entity with job wording", () => {
    render(<EntityCollection entities={entities} view="grid" labels={labels} canManage />);
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByText("J-1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for Kitchen remodel" })).toBeInTheDocument();
  });

  it("table view uses entity field labels and hides actions for non-managers", () => {
    render(<EntityCollection entities={entities} view="table" labels={labels} canManage={false} />);
    expect(screen.getByRole("columnheader", { name: "Job number" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Roof repair" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("EntityDialog", () => {
  it("validates, then creates and closes", async () => {
    createEntity.mockResolvedValue({ ok: true, data: { id: "new" } });
    const onOpenChange = vi.fn();
    render(<EntityDialog open onOpenChange={onOpenChange} labels={labels} />);
    expect(screen.getByRole("heading", { name: "Add job" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();
    expect(createEntity).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Job name"), { target: { value: "Deck build" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(createEntity).toHaveBeenCalledWith(expect.objectContaining({ name: "Deck build" })),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("shows server field errors", async () => {
    createEntity.mockResolvedValue({
      ok: false,
      error: "That reference is already used.",
      fieldErrors: { code: ["Already used."] },
    });
    render(<EntityDialog open onOpenChange={vi.fn()} labels={labels} />);
    fireEvent.change(screen.getByLabelText("Job name"), { target: { value: "Dup" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Already used.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("That reference is already used.");
  });
});
