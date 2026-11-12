// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const base = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  SUPABASE_SERVICE_ROLE_KEY: "service",
};

async function load(env: Record<string, string>) {
  for (const [k, v] of Object.entries({ ...base, ...env })) vi.stubEnv(k, v);
  vi.resetModules();
  return import("./provider");
}

afterEach(() => vi.unstubAllEnvs());

describe("provider selection (config only, no code change)", () => {
  it("OpenRouter: model id passed through, fallbacks options only for Anthropic", async () => {
    const p = await load({
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-5.5",
      OPENROUTER_API_KEY: "k",
    });
    const model = p.extractionModel() as { modelId: string; provider: string };
    expect(model.modelId).toBe("anthropic/claude-sonnet-5.5");
    expect(model.provider).toMatch(/openrouter/);
    expect(p.extractionModelInfo()).toEqual({ provider: "openrouter", model: "anthropic/claude-sonnet-5.5" });
    expect(p.extractionProviderOptions()).toEqual({});
  });

  it("Anthropic: refusal fallbacks on, effort only when set", async () => {
    const p = await load({
      AI_PROVIDER: "anthropic",
      AI_MODEL: "claude-sonnet-5-5",
      ANTHROPIC_API_KEY: "k",
      AI_EFFORT: "low",
    });
    expect(p.extractionProviderOptions()).toEqual({ anthropic: { fallbacks: "default", effort: "low" } });
  });

  it.each([
    ["openrouter", "OPENROUTER_API_KEY"],
    ["anthropic", "ANTHROPIC_API_KEY"],
  ])("%s without a key fails loudly", async (provider, key) => {
    const p = await load({ AI_PROVIDER: provider });
    expect(() => p.extractionModel()).toThrow(key);
  });
});
