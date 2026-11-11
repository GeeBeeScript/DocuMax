import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      // Opacity (not a fixed color) so the eyebrow adapts to light and ink section tones.
      className={cn("font-heading text-sm font-semibold tracking-wide uppercase opacity-70", className)}
      {...props}
    />
  );
}

export type SectionHeadingProps = Omit<ComponentProps<"div">, "title"> & {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  /** Heading level; visual size is the same. */
  as?: "h1" | "h2" | "h3";
};

/** Standard marketing/app section heading: optional eyebrow, display title, lead paragraph. */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  as: Heading = "h2",
  className,
  ...props
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex max-w-3xl flex-col gap-4",
        align === "center" && "mx-auto items-center text-center",
        className,
      )}
      {...props}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Heading className="text-display-md font-bold text-balance md:text-display-lg">{title}</Heading>
      {description && <p className="text-lg text-pretty opacity-75">{description}</p>}
    </div>
  );
}
