import { config } from "dotenv";

// Same precedence as the worker: .env.local, then .env.
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
]) {
  if (!process.env[key]) {
    throw new Error(
      `${key} is missing. Start Supabase (npx supabase start) and copy keys from \`npx supabase status\`.`,
    );
  }
}
