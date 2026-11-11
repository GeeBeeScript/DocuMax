import type { LucideIcon } from "lucide-react";
import { Container } from "@/components/brand/section";
import { Reveal } from "@/components/motion/reveal";

/** Centered single-message band (icon, eyebrow, heading, paragraph). */
export function CalloutBand({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <Container size="narrow">
      <Reveal className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-ink text-yellow">
          <Icon className="size-7" />
        </span>
        <p className="font-heading text-sm font-semibold tracking-wide text-ink-soft uppercase">{eyebrow}</p>
        <h2 className="text-display-md font-bold text-balance">{title}</h2>
        <p className="text-lg text-pretty text-muted-foreground">{description}</p>
      </Reveal>
    </Container>
  );
}
