import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { generateText, LanguageModel } from "ai";
import { serverEnv } from "@/lib/env";
import { createDevExtractionModel } from "./dev-model";

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
    case "openrouter": {
      // One key, many models: AI_MODEL is an OpenRouter id, e.g. "anthropic/claude-sonnet-5.5".
      if (!env.OPENROUTER_API_KEY)
        throw new Error("OPENROUTER_API_KEY is required for AI_PROVIDER=openrouter");
      return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })(env.AI_MODEL);
    }
    case "mock":
      // Checked here, not in env validation: the web app also runs with NODE_ENV=production and never uses AI.
      if (process.env.NODE_ENV === "production")
        throw new Error("AI_PROVIDER=mock is for development and tests only");
      return createDevExtractionModel();
  }
}

/** Provider + model as configured (stored with every extraction for cost/accuracy comparisons). */
export function extractionModelInfo(): { provider: string; model: string } {
  const env = serverEnv();
  return {
    provider: env.AI_PROVIDER,
    model: env.AI_PROVIDER === "mock" ? "heuristic-dev-model" : env.AI_MODEL,
  };
}

/**
 * Per-provider request options. Anthropic: opt into server-side refusal fallbacks ("default" routes a declined
 * request to a suitable fallback model inside the same call) and pass AI_EFFORT when set. Sampling options such as
 * temperature are deliberately not sent: current Claude models reject them, and extraction is constrained by the
 * output schema rather than by sampling.
 */
export function extractionProviderOptions(): Parameters<typeof generateText>[0]["providerOptions"] {
  const env = serverEnv();
  if (env.AI_PROVIDER === "anthropic") {
    return { anthropic: { fallbacks: "default" as const, ...(env.AI_EFFORT && { effort: env.AI_EFFORT }) } };
  }
  return {};
}
