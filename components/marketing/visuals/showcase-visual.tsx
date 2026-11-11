import { demoFields, demoInvoice, demoIssues, demoStatement, demoUploads } from "@/content/demo";
import { BoardCanvas } from "@/components/brand/board-canvas";
import { StickyNote } from "@/components/brand/sticky-note";
import { cn } from "@/lib/utils";
import type { ShowcaseKind } from "@/content/types";
import { ExtractedFieldsMock } from "./extracted-fields-mock";
import { InvoiceMock } from "./invoice-mock";
import { ReviewMock } from "./review-mock";
import { StatementMock } from "./statement-mock";
import { UploadMock } from "./upload-mock";

/**
 * Board-canvas product visual for one workflow step. Content files reference visuals by `kind`
 * so copy stays in /content and JSX stays in components.
 */
export function ShowcaseVisual({ kind, className }: { kind: ShowcaseKind; className?: string }) {
  return (
    <BoardCanvas
      framed
      className={cn("flex min-h-80 items-center justify-center gap-6 p-6 sm:p-10", className)}
    >
      {kind === "upload" && (
        <>
          <InvoiceMock {...demoInvoice} className="hidden md:block" />
          <UploadMock files={demoUploads} />
        </>
      )}
      {kind === "extract" && (
        <>
          <InvoiceMock {...demoInvoice} className="hidden md:block" />
          <ExtractedFieldsMock fields={demoFields} />
        </>
      )}
      {kind === "review" && (
        <>
          <ReviewMock fields={demoFields.slice(0, 4)} issues={demoIssues} />
          <StickyNote color="yellow" tilt="right" className="hidden w-40 text-xs md:block">
            <p className="font-heading font-bold">Reviewer note</p>
            <p className="mt-1 text-ink-soft">Tax confirmed with supplier — approve.</p>
          </StickyNote>
        </>
      )}
      {kind === "report" && (
        <>
          <StatementMock {...demoStatement} />
          <StickyNote color="green" tilt="left" className="hidden w-40 text-xs md:block">
            <p className="font-heading font-bold">Batch ready</p>
            <p className="mt-1 text-ink-soft">24 statements · ZIP download</p>
          </StickyNote>
        </>
      )}
    </BoardCanvas>
  );
}
