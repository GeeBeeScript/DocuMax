import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

/** pdf/styles/print.css (read once; the worker and the dev preview both run from the repo root). */
export function printCss(): string {
  cached ??= readFileSync(path.join(process.cwd(), "pdf/styles/print.css"), "utf8");
  return cached;
}
