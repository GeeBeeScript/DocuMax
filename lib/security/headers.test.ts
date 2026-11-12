import { describe, expect, it } from "vitest";
import { securityHeaders } from "./headers";

const csp = (h: { key: string; value: string }[]) =>
  h.find((x) => x.key === "Content-Security-Policy")!.value;

describe("securityHeaders", () => {
  it("allows only self + the Supabase project, never framing", () => {
    const h = securityHeaders({ supabaseUrl: "https://abc.supabase.co", dev: false });
    expect(csp(h)).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp(h)).toContain("frame-ancestors 'none'");
    expect(csp(h)).toContain("object-src 'none'");
    expect(csp(h)).not.toContain("unsafe-eval");
    expect(h.find((x) => x.key === "Strict-Transport-Security")).toBeDefined();
  });

  it("development: eval for React refresh, ws for local Supabase, no HSTS", () => {
    const h = securityHeaders({ supabaseUrl: "http://127.0.0.1:54321", dev: true });
    expect(csp(h)).toContain("'unsafe-eval'");
    expect(csp(h)).toContain("ws://127.0.0.1:54321");
    expect(h.find((x) => x.key === "Strict-Transport-Security")).toBeUndefined();
  });
});
