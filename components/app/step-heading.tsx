import type { ReactNode } from "react";
import { Eyebrow } from "@/components/brand/section-heading";

/** Heading block for single-column flows (onboarding, invites): eyebrow, h1, description. */
export function StepHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1 className="text-4xl font-extrabold text-balance">{title}</h1>
      {description && <p className="text-pretty text-muted-foreground">{description}</p>}
    </div>
  );
}
