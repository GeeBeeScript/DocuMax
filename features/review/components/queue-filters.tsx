import Link from "next/link";
import { SelectField, type SelectOption } from "@/components/app/select-field";
import { TextField } from "@/components/app/text-field";
import { PillButton } from "@/components/brand/pill-button";
import { reviewCopy } from "@/content/app";
import { ISSUE_CODES } from "@/lib/validation/types";
import { cn } from "@/lib/utils";
import { queueQueryString, type QueueFilters } from "../filters";
import type { QueueCounts } from "../queries";

const copy = reviewCopy.queue;

/**
 * Queue filters as plain links and a GET form — they work without JavaScript and keep state in the URL. Issue chips
 * show how many records carry each code (zero-count codes are hidden).
 */
export function QueueFilterBar({
  filters,
  counts,
  total,
  entityOptions,
  entitySingular,
  entityPlural,
}: {
  filters: QueueFilters;
  counts: QueueCounts;
  total: number;
  entityOptions: readonly SelectOption[];
  entitySingular: string;
  entityPlural: string;
}) {
  const chips: { value: QueueFilters["issue"]; label: string; count: number }[] = [
    { value: undefined, label: copy.all(total), count: total },
    ...(counts.clean ? [{ value: "clean" as const, label: copy.cleanFilter, count: counts.clean }] : []),
    ...ISSUE_CODES.filter((code) => counts[code]).map((code) => ({
      value: code,
      label: reviewCopy.issues[code],
      count: counts[code]!,
    })),
  ];
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label={copy.countsLabel}>
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const active = filters.issue === chip.value;
            return (
              <li key={chip.value ?? "all"}>
                <Link
                  href={`/app/review${queueQueryString({ ...filters, issue: chip.value })}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors",
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-gray-200 bg-paper text-ink-soft hover:border-gray-300 hover:text-ink",
                  )}
                >
                  {chip.label}
                  {chip.value && <span className="tabular-nums opacity-70">{chip.count}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form method="get" action="/app/review" className="flex flex-wrap items-end gap-3">
        {filters.issue && <input type="hidden" name="issue" value={filters.issue} />}
        <SelectField
          id="filter-entity"
          name="entity"
          label={copy.filters.entity(entitySingular)}
          defaultValue={filters.entity ?? ""}
          options={[{ value: "", label: copy.filters.anyEntity(entityPlural) }, ...entityOptions]}
          className="w-full sm:w-56"
        />
        <TextField
          id="filter-supplier"
          name="supplier"
          type="search"
          label={copy.filters.supplier}
          placeholder={copy.filters.supplierPlaceholder}
          defaultValue={filters.supplier ?? ""}
          className="w-full sm:w-56"
        />
        <SelectField
          id="filter-confidence"
          name="confidence"
          label={copy.filters.confidence}
          defaultValue={filters.confidence ?? ""}
          options={[
            { value: "", label: copy.filters.anyConfidence },
            { value: "low", label: copy.filters.lowConfidence },
            { value: "ok", label: copy.filters.okConfidence },
          ]}
          className="w-full sm:w-52"
        />
        <PillButton type="submit" variant="outline" size="sm" className="h-10">
          {copy.filters.apply}
        </PillButton>
        {hasFilters && (
          <PillButton href="/app/review" variant="ghost" size="sm" className="h-10">
            {copy.filters.clear}
          </PillButton>
        )}
      </form>
    </div>
  );
}
