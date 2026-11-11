import { describe, expect, it } from "vitest";
import { assertRole, assignableRoles, canManageMembers, canWrite, ForbiddenError, ORG_ROLES } from "./roles";

describe("role helpers", () => {
  it("only owners and admins manage members", () => {
    expect(ORG_ROLES.filter(canManageMembers)).toEqual(["owner", "admin"]);
  });

  it("viewers are the only read-only role", () => {
    expect(ORG_ROLES.filter((r) => !canWrite(r))).toEqual(["viewer"]);
  });

  it("only owners can assign the owner role", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("admin")).not.toContain("owner");
    expect(assignableRoles("reviewer")).toEqual([]);
  });

  it("assertRole throws ForbiddenError for disallowed or missing roles", () => {
    expect(() => assertRole("viewer", ["owner", "admin"])).toThrow(ForbiddenError);
    expect(() => assertRole(null, ["owner"])).toThrow(ForbiddenError);
    expect(() => assertRole("admin", ["owner", "admin"])).not.toThrow();
  });
});
