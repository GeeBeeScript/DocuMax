import { ArrowRight } from "lucide-react";
import { demoFields, demoInvoice, demoStatement } from "@/content/demo";
import { BoardCanvas } from "@/components/brand/board-canvas";
import { CollabCursor } from "@/components/brand/collab-cursor";
import { StickyNote } from "@/components/brand/sticky-note";
import { Float } from "@/components/motion/float";
import { Reveal } from "@/components/motion/reveal";
import { cn } from "@/lib/utils";
import { ExtractedFieldsMock } from "./extracted-fields-mock";
import { InvoiceMock } from "./invoice-mock";
import { StatementMock } from "./statement-mock";

function Connector() {
  return (
    <div aria-hidden className="flex shrink-0 items-center justify-center text-ink-soft">
      <span className="hidden h-px w-8 border-t-2 border-dashed border-gray-400 lg:block" />
      <ArrowRight className="size-5 rotate-90 lg:rotate-0" />
    </div>
  );
}

/** Hero product visual: messy invoice → checked fields → polished statement, on a live board. */
export function HeroBoard({ className }: { className?: string }) {
  return (
    <BoardCanvas framed className={cn("relative px-6 py-12 sm:px-10 lg:py-16", className)}>
      <div className="flex flex-col items-center justify-center gap-4 lg:flex-row lg:gap-2">
        <Reveal delay={0.1}>
          <InvoiceMock {...demoInvoice} />
        </Reveal>
        <Connector />
        <Reveal delay={0.25}>
          <ExtractedFieldsMock fields={demoFields} />
        </Reveal>
        <Connector />
        <Reveal delay={0.4}>
          <StatementMock {...demoStatement} />
        </Reveal>
      </div>

      <StickyNote
        color="pink"
        tilt="right"
        className="absolute top-6 right-6 hidden w-36 p-3 text-xs xl:block"
        aria-hidden
      >
        Tax looks low — check?
      </StickyNote>
      <Float className="absolute top-10 left-[30%] hidden lg:block" x={20} y={14} duration={7}>
        <CollabCursor label="Maya · Reviewer" color="yellow" />
      </Float>
      <Float className="absolute bottom-8 left-[58%] hidden lg:block" x={-16} y={-10} duration={8} delay={1}>
        <CollabCursor label="Leo · Owner" color="ink" />
      </Float>
    </BoardCanvas>
  );
}
