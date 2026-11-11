import { Stagger, StaggerItem } from "@/components/motion/stagger";
import type { WorkflowStep } from "@/content/types";
import { cn } from "@/lib/utils";

const noteColors = ["bg-note-yellow", "bg-note-blue", "bg-note-pink", "bg-note-green"] as const;

/** Numbered steps laid out as sticky notes connected by a dashed line. */
export function WorkflowSteps({ steps, className }: { steps: readonly WorkflowStep[]; className?: string }) {
  return (
    <div className={cn("relative", className)}>
      <div
        aria-hidden
        className="absolute top-10 right-[12%] left-[12%] hidden border-t-2 border-dashed border-gray-300 lg:block"
      />
      <Stagger as="ol" className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <StaggerItem as="li" key={s.title} className="flex flex-col items-center text-center">
            <span className="z-10 flex size-20 items-center justify-center rounded-full border-4 border-paper bg-ink font-heading text-2xl font-extrabold text-yellow">
              {i + 1}
            </span>
            <div className={cn("mt-4 w-full rounded-sm p-5 shadow-note", noteColors[i % noteColors.length])}>
              <h3 className="font-heading text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{s.description}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}
