import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { serverEnv } from "@/lib/env";

/**
 * Provider-agnostic model selection (ADR-003). The rest of the codebase calls `extractionModel()` and
 * `extractionProviderOptions()` and never imports a provider SDK directly. Configure with AI_PROVIDER + AI_MODEL
 * (+ the matching API key, optional AI_EFFORT) — switching needs no code change.
 *
 * The AI only fills the extraction schema. It never computes totals or allocations — that is lib/calc's job
 * (non-negotiable, see CLAUDE.md).
 */
export function extractionModel(): LanguageModel {
  const env = serverEnv();

  switch (env.AI_PROVIDER) {
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required for AI_PROVIDER=anthropic");
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(env.AI_MODEL);
    }
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for AI_PROVIDER=openai");
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.AI_MODEL);
    }
  }
}

/** Provider + model as configured (stored with every extraction for cost/accuracy comparisons). */
export function extractionModelInfo(): { provider: string; model: string } {
  const env = serverEnv();
  return { provider: env.AI_PROVIDER, model: env.AI_MODEL };
}

/**
 * Per-provider request options. Anthropic: opt into server-side refusal fallbacks ("default" routes a declined
 * request to a suitable fallback model inside the same call) and pass AI_EFFORT when set. Sampling options such as
 * temperature are deliberately not sent: current Claude models reject them, and extraction is constrained by the
 * output schema rather than by sampling.
 */
export function extractionProviderOptions() {
  const env = serverEnv();
  if (env.AI_PROVIDER === "anthropic") {
    return { anthropic: { fallbacks: "default" as const, ...(env.AI_EFFORT && { effort: env.AI_EFFORT }) } };
  }
  return {};
}
