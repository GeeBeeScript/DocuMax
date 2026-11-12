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
  it("defaults to the open model via OpenRouter, routed to no-collection, zero-retention, structured-output hosts", async () => {
    const p = await load({ OPENROUTER_API_KEY: "k" });
    const model = p.extractionModel() as { modelId: string; provider: string };
    expect(model.modelId).toBe("nvidia/nemotron-3.5-super-vl");
    expect(model.provider).toMatch(/openrouter/);
    expect(p.extractionModelInfo()).toEqual({
      provider: "openrouter",
      model: "nvidia/nemotron-3.5-super-vl",
    });
    expect(p.extractionProviderOptions()).toEqual({
      openrouter: { provider: { data_collection: "deny", zdr: true, require_parameters: true } },
    });
  });

  it("any OpenRouter model by id; ZDR can be turned off only explicitly (evals on free models)", async () => {
    const p = await load({
      AI_PROVIDER: "openrouter",
      AI_MODEL: "anthropic/claude-sonnet-5.5",
      OPENROUTER_API_KEY: "k",
      OPENROUTER_ZDR: "false",
    });
    expect((p.extractionModel() as { modelId: string }).modelId).toBe("anthropic/claude-sonnet-5.5");
    expect(p.extractionProviderOptions()).toMatchObject({
      openrouter: { provider: { data_collection: "deny", zdr: false } },
    });
  });

  it("Anthropic: its own default model, refusal fallbacks on, effort only when set", async () => {
    const p = await load({ AI_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", AI_EFFORT: "low" });
    expect(p.extractionModelInfo().model).toBe("claude-sonnet-5-5");
    expect(p.extractionProviderOptions()).toEqual({ anthropic: { fallbacks: "default", effort: "low" } });
  });

  it("OpenAI has no default model: AI_MODEL is required", async () => {
    const p = await load({ AI_PROVIDER: "openai", OPENAI_API_KEY: "k" });
    expect(() => p.extractionModel()).toThrow("AI_MODEL is required");
  });

  it.each([
    ["openrouter", "OPENROUTER_API_KEY"],
    ["anthropic", "ANTHROPIC_API_KEY"],
  ])("%s without a key fails loudly", async (provider, key) => {
    const p = await load({ AI_PROVIDER: provider });
    expect(() => p.extractionModel()).toThrow(key);
  });
});
