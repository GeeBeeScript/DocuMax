"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Split, Trash2 } from "lucide-react";
import { FormAlert } from "@/components/app/form-alert";
import { Money } from "@/components/app/money";
import { type SelectOption } from "@/components/app/select-field";
import { PillButton } from "@/components/brand/pill-button";
import { allocationCopy as copy } from "@/content/app";
import {
  AllocationError,
  allocateByAmount,
  allocateByPercent,
  formatBp,
  parsePercentBp,
  type Share,
} from "@/lib/calc/allocate";
import { centsToDecimal, cents, parseToCents } from "@/lib/calc/money";
import { cn } from "@/lib/utils";
import { setAllocations } from "../actions";

export interface InitialSplit {
  method: "percent" | "amount";
  rows: { entityId: string; percentBp: number | null; amountCents: number | null }[];
}

interface Row {
  key: string;
  entityId: string;
  value: string;
}

let seq = 0;
const rowKey = () => `split-${++seq}`;
const HOME = "__home__";

const cellInput =
  "h-10 w-full rounded-lg border border-input bg-paper px-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-danger disabled:opacity-50";

/**
 * Record-level split editor. Previews the exact cents each entity gets with the same lib/calc functions the
 * statements use; the action validates again and the database a third time.
 */
export function AllocationEditor({
  recordId,
  totalCents,
  currency,
  homeEntityId,
  entityOptions,
  initial,
  hasLineSplits,
  disabled,
  disabledReason,
  singular,
  plural,
}: {
  recordId: string;
  totalCents: number | null;
  currency: string | null;
  homeEntityId: string | null;
  entityOptions: readonly SelectOption[];
  initial: InitialSplit | null;
  hasLineSplits: boolean;
  disabled: boolean;
  disabledReason?: string;
  singular: string;
  plural: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [method, setMethod] = useState<"percent" | "amount">(initial?.method ?? "percent");
  const [rows, setRows] = useState<Row[]>(() => toRows(initial, homeEntityId));
  const [error, setError] = useState<string | null>(null);
  const names = useMemo(() => new Map(entityOptions.map((o) => [o.value, o.label])), [entityOptions]);
  const homeName = homeEntityId ? (names.get(homeEntityId) ?? null) : null;

  // Parse + preview (exact cents per row, plus the remainder for fixed amounts).
  const preview = useMemo(() => {
    const parsed = rows.map((r) =>
      method === "percent" ? parsePercentBp(r.value) : r.value.trim() ? parseToCents(r.value) : null,
    );
    const invalidRows = new Set(
      rows.map((r, i) => (parsed[i] == null || !r.entityId ? i : -1)).filter((i) => i >= 0),
    );
    let shares: Share[] | null = null;
    let problem: string | null = null;
    if (totalCents == null) problem = copy.noTotal;
    else if (invalidRows.size === 0 && rows.length > 0) {
      try {
        shares =
          method === "percent"
            ? allocateByPercent(
                cents(totalCents),
                rows.map((r, i) => ({ key: r.entityId, percentBp: parsed[i]! })),
              )
            : allocateByAmount(
                cents(totalCents),
                rows.map((r, i) => ({ key: r.entityId, amountCents: cents(parsed[i]!) })),
                homeEntityId ?? HOME,
              );
      } catch (e) {
        if (!(e instanceof AllocationError)) throw e;
        problem = e.message;
      }
    }
    const percentTotal = method === "percent" ? parsed.reduce<number>((a, p) => a + (p ?? 0), 0) : null;
    return { parsed, invalidRows, shares, problem, percentTotal };
  }, [rows, method, totalCents, homeEntityId]);

  const amountFor = (entityId: string) => preview.shares?.find((s) => s.key === entityId)?.cents ?? null;
  const remainder =
    method === "amount"
      ? (preview.shares?.find((s) => !rows.some((r) => r.entityId === s.key)) ?? null)
      : null;

  const save = (clear = false) => {
    setError(null);
    if (!clear && (preview.invalidRows.size > 0 || preview.problem || !preview.shares)) {
      setError(preview.problem ?? (method === "percent" ? copy.invalidPercent : copy.invalidAmount));
      return;
    }
    startTransition(async () => {
      const result = await setAllocations({
        recordId,
        method,
        splits: clear
          ? []
          : rows.map((r, i) =>
              method === "percent"
                ? { entityId: r.entityId, percentBp: preview.parsed[i]! }
                : { entityId: r.entityId, amountCents: preview.parsed[i]! },
            ),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(clear ? copy.cleared : copy.saved);
      setEditing(false);
      if (clear) setRows(toRows(null, homeEntityId));
      router.refresh();
    });
  };

  const summary = initial ? (
    <ul className="flex flex-col gap-1 text-sm">
      {initial.rows.map((r) => (
        <li key={r.entityId} className="flex justify-between gap-4">
          <span>{names.get(r.entityId) ?? r.entityId.slice(0, 8)}</span>
          <span className="tabular-nums">
            {initial.method === "percent" ? (
              `${formatBp(r.percentBp ?? 0)}%`
            ) : (
              <Money value={r.amountCents} currency={currency} />
            )}
          </span>
        </li>
      ))}
      {initial.method === "amount" && <li className="text-muted-foreground">{copy.rest(homeName)}</li>}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{copy.none(homeName, singular)}</p>
  );

  return (
    <section
      aria-labelledby="split-heading"
      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-paper p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="split-heading" className="font-heading text-lg font-bold">
            {copy.title(plural)}
          </h2>
          <p className="text-sm text-muted-foreground">{copy.description(plural)}</p>
        </div>
        {!editing && !disabled && totalCents != null && (
          <PillButton variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Split aria-hidden /> {initial ? copy.edit : copy.start}
          </PillButton>
        )}
      </div>

      {!editing ? (
        <>
          {summary}
          {disabled && disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
        </>
      ) : (
        <div className="flex flex-col gap-3">
          {hasLineSplits && <FormAlert tone="info">{copy.lineSplitsNote}</FormAlert>}
          {error && <FormAlert tone="danger">{error}</FormAlert>}
          <div
            role="radiogroup"
            aria-label={copy.methodLabel}
            className="flex gap-1 self-start rounded-full bg-gray-100 p-1"
          >
            {(["percent", "amount"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => {
                  setMethod(m);
                  setRows((rs) => rs.map((r) => ({ ...r, value: "" })));
                }}
                className={cn(
                  "h-8 rounded-full px-3 text-sm font-semibold text-ink-soft",
                  method === m && "bg-paper text-ink shadow-sm",
                )}
              >
                {copy.methods[m]}
              </button>
            ))}
          </div>

          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-gray-500 uppercase">
              <tr>
                <th scope="col" className="pb-1 font-semibold">
                  {copy.entity(singular)}
                </th>
                <th scope="col" className="w-32 pb-1 font-semibold">
                  {copy.value[method]}
                </th>
                <th scope="col" className="w-28 pb-1 text-right font-semibold">
                  {copy.result}
                </th>
                <th scope="col" className="w-10">
                  <span className="sr-only">{copy.removeHeader}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.key}>
                  <td className="py-1 pr-2">
                    <select
                      aria-label={`${copy.entity(singular)}, row ${i + 1}`}
                      value={row.entityId}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, entityId: e.target.value } : r)))
                      }
                      className={cellInput}
                    >
                      <option value="">{copy.chooseEntity}</option>
                      {entityOptions.map((o) => (
                        <option
                          key={o.value}
                          value={o.value}
                          disabled={rows.some((r, j) => j !== i && r.entityId === o.value)}
                        >
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      aria-label={`${copy.value[method]}, row ${i + 1}`}
                      inputMode="decimal"
                      autoComplete="off"
                      value={row.value}
                      aria-invalid={row.value.trim() !== "" && preview.parsed[i] == null ? true : undefined}
                      onChange={(e) =>
                        setRows((rs) => rs.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))
                      }
                      className={cn(cellInput, "text-right tabular-nums")}
                    />
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    <Money value={row.entityId ? amountFor(row.entityId) : null} currency={currency} />
                  </td>
                  <td className="py-1 text-right">
                    <button
                      type="button"
                      aria-label={copy.remove(i + 1)}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      className="inline-flex size-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-danger"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
              {remainder && remainder.cents !== 0 && (
                <tr className="text-muted-foreground">
                  <td colSpan={2} className="py-1">
                    {copy.rest(homeName)}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    <Money value={remainder.cents} currency={currency} />
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex flex-wrap items-center gap-2">
            <PillButton
              variant="ghost"
              size="sm"
              onClick={() => setRows((rs) => [...rs, { key: rowKey(), entityId: "", value: "" }])}
              disabled={rows.length >= entityOptions.length}
            >
              <Plus aria-hidden /> {copy.add(singular)}
            </PillButton>
            {preview.percentTotal != null && (
              <span
                className={cn(
                  "text-sm tabular-nums",
                  preview.percentTotal === 10_000 ? "text-success" : "text-muted-foreground",
                )}
                aria-live="polite"
              >
                {copy.totalPercent(formatBp(preview.percentTotal))}
              </span>
            )}
          </div>
          {preview.problem && preview.invalidRows.size === 0 && (
            <p className="text-sm text-danger" role="alert">
              {preview.problem}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {initial && (
              <PillButton variant="ghost" size="sm" disabled={pending} onClick={() => save(true)}>
                {copy.clear}
              </PillButton>
            )}
            <PillButton
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setError(null);
                setRows(toRows(initial, homeEntityId));
                setMethod(initial?.method ?? "percent");
              }}
            >
              {copy.cancel}
            </PillButton>
            <PillButton size="sm" disabled={pending} onClick={() => save()}>
              {copy.save}
            </PillButton>
          </div>
        </div>
      )}
    </section>
  );
}

function toRows(initial: InitialSplit | null, homeEntityId: string | null): Row[] {
  if (initial?.rows.length)
    return initial.rows.map((r) => ({
      key: rowKey(),
      entityId: r.entityId,
      value:
        initial.method === "percent"
          ? formatBp(r.percentBp ?? 0)
          : r.amountCents == null
            ? ""
            : centsToDecimal(cents(r.amountCents)),
    }));
  // Start with the record's own entity and one more row.
  return [
    { key: rowKey(), entityId: homeEntityId ?? "", value: "" },
    { key: rowKey(), entityId: "", value: "" },
  ];
}
