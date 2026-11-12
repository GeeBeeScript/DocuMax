/**
 * Extraction eval (Phase 5 acceptance): runs the real pipeline — text layer / OCR → AI extraction → mapping — on
 * every labeled fixture and scores the required fields. Pass bar: ≥ 90% of fixtures fully correct.
 *
 *   npm run eval:extraction                 # uses AI_PROVIDER / AI_MODEL / AI_EFFORT from .env.local
 *   AI_PROVIDER=mock npm run eval:extraction  # check the harness without an API key (heuristic dev model)
 *   npm run eval:extraction -- --only euro  # fixtures whose file name contains "euro"
 *   npm run eval:extraction -- --json       # machine-readable report on stdout
 *
 * This calls the configured AI provider for real (one call per fixture, plus retries) — it costs money. Run it
 * manually or nightly, never in CI.
 */
import "../worker/load-env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractInvoice } from "@/lib/ai/extract";
import { extractionModel, extractionModelInfo, extractionProviderOptions } from "@/lib/ai/provider";
import { extractDocumentText } from "@/lib/pipeline/extract-document";
import { mapExtraction } from "@/lib/pipeline/map-extraction";
import { createTesseractEngine } from "@/lib/pipeline/ocr";
import {
  SCORED_FIELDS,
  scoreFields,
  summarize,
  type ExpectedFields,
  type FixtureScore,
} from "./eval-scoring";

const PASS_BAR = 0.9;
const FIXTURES = path.join(process.cwd(), "tests/fixtures");

interface Label {
  file: string;
  mimeType: string;
  expected: ExpectedFields;
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
  const json = args.includes("--json");
  const log = (...m: unknown[]) => !json && console.log(...m);

  const { fixtures } = JSON.parse(await readFile(path.join(FIXTURES, "labels/extraction.json"), "utf8")) as {
    fixtures: Label[];
  };
  const selected = fixtures.filter((f) => !only || f.file.includes(only));
  const info = extractionModelInfo();
  const model = extractionModel();
  const providerOptions = extractionProviderOptions();
  const ocr = await createTesseractEngine({ workers: 2 });
  log(`Evaluating ${selected.length} fixtures with ${info.provider}/${info.model}\n`);

  const scores: (FixtureScore & {
    attempts: number;
    tokensIn: number;
    tokensOut: number;
    ms: number;
    error?: string;
  })[] = [];
  try {
    for (const label of selected) {
      const bytes = new Uint8Array(await readFile(path.join(FIXTURES, label.file)));
      try {
        const text = await extractDocumentText(bytes, label.mimeType, { ocr });
        const run = await extractInvoice(
          text.pages.map((p) => ({ pageNo: p.pageNo, text: p.text })),
          { entityKind: "property", entities: [] },
          { model, providerOptions },
        );
        const { record } = mapExtraction(run.extraction, {
          pages: text.pages.map((p) => ({ source: p.source, ocrConfidence: p.ocrConfidence })),
          entities: [],
        });
        const fields = scoreFields(record, label.expected);
        const correct = SCORED_FIELDS.every((f) => fields[f]);
        scores.push({
          file: label.file,
          fields,
          correct,
          attempts: run.attempts,
          tokensIn: run.usage.inputTokens,
          tokensOut: run.usage.outputTokens,
          ms: run.latencyMs,
        });
        const misses = SCORED_FIELDS.filter((f) => !fields[f]).map((f) => {
          const got = {
            supplierName: record.supplier_name,
            invoiceNumber: record.invoice_number,
            issueDate: record.issue_date,
            totalCents: record.total_cents,
            currency: record.currency,
          }[f];
          return `${f}: got ${JSON.stringify(got)}, want ${JSON.stringify(label.expected[f])}`;
        });
        log(
          `${correct ? "PASS" : "FAIL"}  ${label.file}  (${run.attempts} attempt(s), ${run.latencyMs} ms, ${run.usage.inputTokens}+${run.usage.outputTokens} tokens)`,
        );
        for (const m of misses) log(`      ${m}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        scores.push({
          file: label.file,
          fields: Object.fromEntries(SCORED_FIELDS.map((f) => [f, false])) as FixtureScore["fields"],
          correct: false,
          attempts: 0,
          tokensIn: 0,
          tokensOut: 0,
          ms: 0,
          error: message,
        });
        log(`ERROR ${label.file}: ${message}`);
      }
    }
  } finally {
    await ocr.terminate();
  }

  const summary = summarize(scores);
  const tokens = scores.reduce((t, s) => ({ in: t.in + s.tokensIn, out: t.out + s.tokensOut }), {
    in: 0,
    out: 0,
  });
  const passed = summary.accuracy >= PASS_BAR;
  if (json) {
    console.log(
      JSON.stringify({ model: info, passBar: PASS_BAR, passed, summary, tokens, fixtures: scores }, null, 2),
    );
  } else {
    log(
      `\n${summary.correct}/${summary.fixtures} fixtures fully correct = ${(summary.accuracy * 100).toFixed(0)}% (bar ${PASS_BAR * 100}%) → ${passed ? "PASS" : "FAIL"}`,
    );
    log(
      `Per field: ${SCORED_FIELDS.map((f) => `${f} ${(summary.perField[f] * 100).toFixed(0)}%`).join(" · ")}`,
    );
    log(`Tokens: ${tokens.in} in / ${tokens.out} out`);
  }
  process.exitCode = passed ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 2;
});
