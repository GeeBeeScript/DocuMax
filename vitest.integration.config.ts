import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Integration tests against local Supabase (`npx supabase start`). Node environment, one file at a time
 * (files share one database), generous timeouts for auth + realtime round-trips.
 */
export default defineConfig({
  // pdf/ templates are TSX; tsconfig keeps "jsx": "preserve" for Next.
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/integration/setup.ts", "./tests/integration/next-mocks.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
