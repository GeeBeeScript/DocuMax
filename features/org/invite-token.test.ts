import { describe, expect, it } from "vitest";
import { createInviteToken, hashInviteToken } from "./invite-token";

describe("invite tokens", () => {
  it("are unique, URL-safe and hashed with sha256", () => {
    const a = createInviteToken();
    const b = createInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a.hash).toBe(hashInviteToken(a.token));
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
