import { z } from "zod";

/**
 * Environment validation. Import `serverEnv()` only from server code / the worker,
 * `clientEnv` anywhere. Values are parsed lazily so `next build` and unit tests
 * don't require a fully populated environment.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

const serverSchema = clientSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  /** `mock` = deterministic dev/test model (lib/ai/dev-model.ts); extractionModel() refuses it in production. */
  AI_PROVIDER: z.enum(["anthropic", "openai", "openrouter", "mock"]).default("openrouter"),
  /** Optional: each provider has a default model (lib/ai/provider.ts → DEFAULT_MODELS). */
  AI_MODEL: z.string().min(1).optional(),
  /** OpenRouter: only route to zero-data-retention endpoints (default on; off only for evals on free models). */
  OPENROUTER_ZDR: z.stringbool().default(true),
  /** Optional reasoning effort for providers that support it (Anthropic: low … max). Unset = model default. */
  AI_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  /** Stripe price ids per plan and interval (lib/billing/stripe.ts). Unset = that plan can't be bought yet. */
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().optional(),
  STRIPE_PRICE_BUSINESS_YEARLY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError) {
  return error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
}

let cachedServer: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  if (!cachedServer) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(`Invalid server environment:\n${format(parsed.error)}`);
    }
    cachedServer = parsed.data;
  }
  return cachedServer;
}

let cachedClient: ClientEnv | undefined;

export function clientEnv(): ClientEnv {
  if (!cachedClient) {
    // NEXT_PUBLIC_* must be referenced literally so Next inlines them.
    const parsed = clientSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    });
    if (!parsed.success) {
      throw new Error(`Invalid client environment:\n${format(parsed.error)}`);
    }
    cachedClient = parsed.data;
  }
  return cachedClient;
}
