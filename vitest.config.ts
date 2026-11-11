import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./tests/setup/vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    // *.slow.test.ts (real OCR) only run with SLOW_TESTS=1 (`npm run test:slow`).
    exclude: [
      "node_modules",
      ".next",
      "tests/e2e/**",
      "tests/integration/**",
      ...(process.env.SLOW_TESTS ? [] : ["**/*.slow.test.ts"]),
    ],
    css: false,
  },
});
