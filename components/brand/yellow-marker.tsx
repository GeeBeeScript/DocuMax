import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Highlighter band behind inline text. Use for 1–3 key words in a headline, never whole sentences. */
export function YellowMarker({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("marker-yellow px-1", className)} {...props} />;
}
