import { describe, expect, it } from "vitest";
import { scrubEvent } from "./scrub";

describe("scrubEvent", () => {
  it("keeps ids and route, drops personal data", () => {
    const out = scrubEvent({
      message: "invite to sam@example.com failed",
      user: { id: "u1", email: "sam@example.com", ip_address: "203.0.113.7" },
      request: {
        method: "POST",
        url: "https://app.test/app/documents?token=secret",
        cookies: { sb: "x" },
        headers: { authorization: "Bearer x" },
        data: { password: "p" },
      },
      breadcrumbs: [{ message: "console: sam@example.com" }],
      extra: { body: "..." },
      exception: { values: [{ type: "Error", value: "no user sam@example.com" }] },
      tags: { org_id: "o1", queue: "render-report" },
    });
    expect(out).toEqual({
      message: "invite to [email] failed",
      user: { id: "u1" },
      request: { method: "POST", url: "https://app.test/app/documents" },
      exception: { values: [{ type: "Error", value: "no user [email]" }] },
      tags: { org_id: "o1", queue: "render-report" },
    });
  });
});
