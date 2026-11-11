import { Check, TriangleAlert, X } from "lucide-react";
import { statusToneVariants } from "@/components/app/status-badge";
import { cn } from "@/lib/utils";
import { ExtractedFieldsMock, type ExtractedFieldsMockProps } from "./extracted-fields-mock";

export type ReviewMockProps = ExtractedFieldsMockProps & {
  issues: readonly { tone: "attention" | "danger"; text: string }[];
};

/** Review queue item: issue flags + fields + approve/reject. */
export function ReviewMock({ fields, issues, className }: ReviewMockProps) {
  return (
    <div aria-hidden className={cn("flex w-80 flex-col gap-2", className)}>
      {issues.map((i) => (
        <div key={i.text} className={cn(statusToneVariants({ tone: i.tone }), "w-full rounded-lg px-3 py-2")}>
          <TriangleAlert className="size-3.5 shrink-0" />
          <span className="truncate">{i.text}</span>
        </div>
      ))}
      <ExtractedFieldsMock fields={fields} className="w-full" />
      <div className="flex justify-end gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-ink px-3 py-1 text-xs font-semibold">
          <X className="size-3" /> Reject
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper">
          <Check className="size-3" /> Approve
        </span>
      </div>
    </div>
  );
}
