import { Check } from "lucide-react";
import { BoardCanvas } from "@/components/brand/board-canvas";
import { CollabCursor } from "@/components/brand/collab-cursor";
import { StickyNote } from "@/components/brand/sticky-note";
import { Float } from "@/components/motion/float";
import { StatementMock } from "./visuals/statement-mock";
import { demoStatement } from "@/content/demo";

/** Right-hand brand panel on auth pages: yellow board with a statement mock and value points. */
export function AuthAside({ title, points }: { title: string; points: readonly string[] }) {
  return (
    <div className="relative flex h-full flex-col justify-between gap-10 overflow-hidden bg-yellow p-10 xl:p-14">
      <div className="flex flex-col gap-6">
        <h2 className="max-w-md text-display-md font-extrabold text-balance">{title}</h2>
        <ul className="flex flex-col gap-3">
          {points.map((p) => (
            <li key={p} className="flex items-center gap-3 font-medium">
              <span className="flex size-6 items-center justify-center rounded-full bg-ink">
                <Check className="size-3.5 text-yellow" strokeWidth={3} />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <BoardCanvas framed className="relative flex min-h-80 items-center justify-center border-ink/10 p-8">
        <StatementMock {...demoStatement} />
        <StickyNote color="pink" tilt="right" aria-hidden className="absolute top-6 right-6 w-32 p-3 text-xs">
          Sent to owner ✓
        </StickyNote>
        <Float className="absolute bottom-8 left-8" x={14} y={-8} duration={7}>
          <CollabCursor label="You" color="ink" />
        </Float>
      </BoardCanvas>
    </div>
  );
}
