import { ConfidencePill } from "@/components/app/confidence-pill";
import { cn } from "@/lib/utils";
import { MockWindow } from "./mock-window";

export type ExtractedFieldsMockProps = {
  fields: readonly { label: string; value: string; confidence: number }[];
  className?: string;
};

/** Structured fields with per-field confidence — the "checked data" output. */
export function ExtractedFieldsMock({ fields, className }: ExtractedFieldsMockProps) {
  return (
    <MockWindow title="Extracted data" className={cn("w-72", className)}>
      <dl className="space-y-2 text-xs">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-3">
            <dt className="text-gray-500">{f.label}</dt>
            <dd className="flex items-center gap-2 font-medium text-ink">
              <span className="max-w-32 truncate">{f.value}</span>
              <ConfidencePill score={f.confidence} />
            </dd>
          </div>
        ))}
      </dl>
    </MockWindow>
  );
}
