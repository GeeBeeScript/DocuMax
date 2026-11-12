import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteOrganization } from "./delete-organization";

const deleteOrganization = vi.hoisted(() => vi.fn());
vi.mock("../actions", () => ({ deleteOrganization }));

describe("DeleteOrganization", () => {
  it("only enables deletion once the exact name is typed", async () => {
    deleteOrganization.mockResolvedValue({ ok: false, error: "Some files couldn't be deleted." });
    render(<DeleteOrganization orgName="Harbor & Pine" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete organization" }));
    const confirm = screen.getByRole("button", { name: "Delete forever" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "harbor & pine" } });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Organization name"), { target: { value: "Harbor & Pine" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(deleteOrganization).toHaveBeenCalledWith({ confirmName: "Harbor & Pine" }));
    expect(await screen.findByText("Some files couldn't be deleted.")).toBeInTheDocument();
  });
});
