import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { MemberRow } from "../queries";
import { MemberList } from "./member-list";

vi.mock("../actions", () => ({ changeMemberRole: vi.fn(), removeMember: vi.fn() }));

const member = (id: string, role: MemberRow["role"], name: string): MemberRow => ({
  membershipId: `00000000-0000-4000-8000-00000000000${id}`,
  userId: `user-${id}`,
  role,
  name,
  email: `${name.toLowerCase()}@example.test`,
  joinedAt: "2026-11-11T00:00:00Z",
});
const members = [member("1", "owner", "Olive"), member("2", "admin", "Adam"), member("3", "viewer", "Vera")];
const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

describe("MemberList", () => {
  it("owners can change anyone else's role, including granting owner", () => {
    render(<MemberList members={members} viewerId="user-1" viewerRole="owner" />);
    const select = within(row("Adam")).getByRole("combobox");
    expect(within(select).getByRole("option", { name: "Owner" })).toBeInTheDocument();
    expect(within(row("Vera")).getByRole("button", { name: "Remove Vera" })).toBeInTheDocument();
  });

  it("the only owner is not offered 'Leave organization'", () => {
    render(<MemberList members={members} viewerId="user-1" viewerRole="owner" />);
    expect(within(row("Olive")).queryByRole("button")).toBeNull();
  });

  it("admins cannot act on owners or grant owner", () => {
    render(<MemberList members={members} viewerId="user-2" viewerRole="admin" />);
    expect(within(row("Olive")).queryByRole("combobox")).toBeNull();
    expect(within(row("Olive")).queryByRole("button")).toBeNull();
    const select = within(row("Vera")).getByRole("combobox");
    expect(within(select).queryByRole("option", { name: "Owner" })).toBeNull();
    expect(within(row("Adam")).getByRole("button", { name: "Leave organization" })).toBeInTheDocument();
  });

  it("viewers see roles read-only and can only leave", () => {
    render(<MemberList members={members} viewerId="user-3" viewerRole="viewer" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(within(row("Vera")).getByRole("button", { name: "Leave organization" })).toBeInTheDocument();
  });
});
