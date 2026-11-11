import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { serverEnv } from "@/lib/env";

/**
 * Provider-agnostic model selection (ADR-003). The rest of the codebase calls
 * `extractionModel()` and never imports a provider SDK directly.
 * Configure with AI_PROVIDER + AI_MODEL (+ the matching API key).
 *
 * The AI only fills the extraction schema. It never computes totals or
 * allocations — that is lib/calc's job (non-negotiable, see CLAUDE.md).
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
