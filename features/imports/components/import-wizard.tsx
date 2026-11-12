"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp } from "lucide-react";
import { FormAlert } from "@/components/app/form-alert";
import { PillButton } from "@/components/brand/pill-button";
import { Label } from "@/components/ui/label";
import { dataCopy } from "@/content/app";
import { IMPORT_FIELDS, type ImportField, type ImportMapping } from "@/lib/import/fields";
import { parseRow, type ImportEntity } from "@/lib/import/rows";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { createImport, startImport, type ImportPreview } from "../actions";

const copy = dataCopy.import;
const MAX_BYTES = 5 * 1024 * 1024;
const select =
  "h-9 w-full rounded-lg border border-input bg-paper px-2 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-danger";

/**
 * CSV import in three steps: choose a file (uploaded straight to `{org}/imports/`), match columns (suggested from
 * the headers and the org's last mapping), check the preview — validated live with the same parseRow the worker
 * uses — then start. Invalid rows are skipped and reported, never imported.
 */
export function ImportWizard({
  orgId,
  entities,
  defaultCurrency,
  canApprove,
}: {
  orgId: string;
  entities: readonly ImportEntity[];
  defaultCurrency: string;
  canApprove: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [approve, setApprove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const results = useMemo(
    () => (preview ? preview.rows.map((row) => parseRow(row, mapping, { entities, defaultCurrency })) : []),
    [preview, mapping, entities, defaultCurrency],
  );
  const okCount = results.filter((r) => r.ok).length;
  const failing = results.flatMap((r, i) => (r.ok ? [] : [{ row: i + 2, errors: r.errors }]));

  const reset = () => {
    setPreview(null);
    setFileName(null);
    setError(null);
    setApprove(false);
  };

  const choose = async (file: File) => {
    setError(null);
    if (!/\.csv$/i.test(file.name)) return setError(copy.wrongType);
    if (file.size > MAX_BYTES) return setError(copy.tooBig);
    setBusy(true);
    const path = `${orgId}/imports/${crypto.randomUUID()}.csv`;
    const { error: uploadError } = await createSupabaseBrowserClient()
      .storage.from("imports")
      .upload(path, file, { contentType: "text/csv" });
    if (uploadError) {
      setBusy(false);
      return setError(uploadError.message);
    }
    const result = await createImport({ storagePath: path, fileName: file.name });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setFileName(file.name);
    setPreview(result.data);
    setMapping(result.data.mapping);
  };

  const start = () =>
    startTransition(async () => {
      if (!preview) return;
      const result = await startImport({ importId: preview.importId, mapping, approve });
      if (!result.ok) return setError(result.error);
      toast.success(copy.started);
      reset();
      router.refresh();
    });

  if (!preview) {
    return (
      <div className="flex flex-col gap-3">
        {error && <FormAlert tone="danger">{error}</FormAlert>}
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label={copy.choose}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void choose(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <PillButton size="sm" disabled={busy} onClick={() => input.current?.click()}>
            <FileUp aria-hidden /> {busy ? copy.uploading : copy.choose}
          </PillButton>
          <a
            href="/app/data/import-template"
            className="text-sm font-semibold underline-offset-2 hover:underline"
          >
            {copy.template}
          </a>
        </div>
      </div>
    );
  }

  const shown = preview.rows.length;
  return (
    <div className="flex flex-col gap-5">
      <h3 className="font-heading text-base font-bold">
        {copy.mappingTitle(fileName ?? "", preview.rowCount)}
      </h3>
      {error && <FormAlert tone="danger">{error}</FormAlert>}

      <table className="w-full text-sm">
        <thead className="text-left text-xs tracking-wide text-gray-500 uppercase">
          <tr>
            <th scope="col" className="pb-2 font-semibold">
              {copy.field}
            </th>
            <th scope="col" className="pb-2 font-semibold">
              {copy.column}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {IMPORT_FIELDS.map((f) => {
            const missing = f.required && !mapping[f.key];
            return (
              <tr key={f.key}>
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold">
                  {f.label}
                  {f.required && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">({copy.required})</span>
                  )}
                </th>
                <td className="py-1.5">
                  <select
                    aria-label={f.label}
                    aria-invalid={missing || undefined}
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f.key as ImportField]: e.target.value || null }))
                    }
                    className={select}
                  >
                    <option value="">{copy.notInFile}</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section aria-label={copy.preview(shown)} className="flex flex-col gap-2">
        <p className={cn("text-sm", failing.length ? "text-ink" : "text-success")} role="status">
          {copy.previewOk(okCount, shown)} {failing.length > 0 && copy.previewErrors(failing.length)}
        </p>
        {failing.length > 0 && (
          <div className="max-h-56 overflow-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-left text-xs tracking-wide text-gray-500 uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {copy.row}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {copy.problems}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {failing.map((f) => (
                  <tr key={f.row}>
                    <td className="px-3 py-1.5 align-top tabular-nums">{f.row}</td>
                    <td className="px-3 py-1.5">
                      {f.errors.map((e) => `${e.column}: ${e.message}`).join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canApprove && (
        <div className="flex items-start gap-2">
          <input
            id="import-approve"
            type="checkbox"
            checked={approve}
            onChange={(e) => setApprove(e.target.checked)}
            className="mt-1 size-4 accent-ink"
          />
          <div>
            <Label htmlFor="import-approve">{copy.approve}</Label>
            <p className="text-xs text-muted-foreground">{copy.approveHint}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <PillButton size="sm" disabled={pending} onClick={start}>
          {copy.start}
        </PillButton>
        <PillButton variant="ghost" size="sm" disabled={pending} onClick={reset}>
          {copy.cancel}
        </PillButton>
      </div>
    </div>
  );
}
