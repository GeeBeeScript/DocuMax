import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { generateText, LanguageModel } from "ai";
import { serverEnv, type ServerEnv } from "@/lib/env";
import { createDevExtractionModel } from "./dev-model";

/**
 * Provider-agnostic model selection (ADR-003). The rest of the codebase calls `extractionModel()` and
 * `extractionProviderOptions()` and never imports a provider SDK directly. Configure with AI_PROVIDER (+ optional
 * AI_MODEL, the matching API key, optional AI_EFFORT) — switching needs no code change.
 *
 * Default: the open model NVIDIA Nemotron 3.5 Super via OpenRouter, routed only to endpoints that neither collect
 * nor retain prompts (ADR-018).
 *
 * The AI only fills the extraction schema. It never computes totals or allocations — that is lib/calc's job
 * (non-negotiable, see AGENTS.md).
 */

/** Default model per provider when AI_MODEL is unset. */
export const DEFAULT_MODELS: Record<ServerEnv["AI_PROVIDER"], string | null> = {
  openrouter: "nvidia/nemotron-3.5-super-vl",
  anthropic: "claude-sonnet-5-5",
  openai: null, // set AI_MODEL explicitly
  mock: "heuristic-dev-model",
};

function modelId(env: ServerEnv): string {
  const id = env.AI_MODEL ?? DEFAULT_MODELS[env.AI_PROVIDER];
  if (!id) throw new Error(`AI_MODEL is required for AI_PROVIDER=${env.AI_PROVIDER}`);
  return id;
}

export function extractionModel(): LanguageModel {
  const env = serverEnv();

  switch (env.AI_PROVIDER) {
    case "openrouter": {
      // One key, many models: AI_MODEL is an OpenRouter id, e.g. "nvidia/nemotron-3.5-super-vl".
      if (!env.OPENROUTER_API_KEY)
        throw new Error("OPENROUTER_API_KEY is required for AI_PROVIDER=openrouter");
      return createOpenRouter({ apiKey: env.OPENROUTER_API_KEY })(modelId(env));
    }
    case "anthropic": {
      if (!env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required for AI_PROVIDER=anthropic");
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(modelId(env));
    }
    case "openai": {
      if (!env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for AI_PROVIDER=openai");
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(modelId(env));
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
  return { provider: env.AI_PROVIDER, model: modelId(env) };
}

/**
 * Per-provider request options. Sampling options such as temperature are deliberately never sent (ADR-015):
 * extraction is constrained by the output schema, and several current models reject sampling parameters.
 *
 * - OpenRouter: customer invoices must not be stored or used for training by whichever host serves the model.
 *   `data_collection: "deny"` + `zdr: true` restrict routing to hosts that neither collect nor retain prompts, and
 *   `require_parameters` to hosts that honor structured output (ADR-018).
 * - Anthropic: server-side refusal fallbacks, plus AI_EFFORT when set (ADR-015).
 */
export function extractionProviderOptions(): Parameters<typeof generateText>[0]["providerOptions"] {
  const env = serverEnv();
  switch (env.AI_PROVIDER) {
    case "openrouter":
      return {
        openrouter: {
          provider: { data_collection: "deny" as const, zdr: env.OPENROUTER_ZDR, require_parameters: true },
        },
      };
    case "anthropic":
      return {
        anthropic: { fallbacks: "default" as const, ...(env.AI_EFFORT && { effort: env.AI_EFFORT }) },
      };
    default:
      return {};
  }
}
