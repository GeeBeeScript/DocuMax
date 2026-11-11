import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Horizontal page container. Every marketing/app section aligns to this. */
export function Container({
  className,
  size = "default",
  ...props
}: ComponentProps<"div"> & { size?: "default" | "wide" | "narrow" }) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6",
        size === "default" && "max-w-6xl",
        size === "wide" && "max-w-7xl",
        size === "narrow" && "max-w-3xl",
        className,
      )}
      {...props}
    />
  );
}

const sectionVariants = cva("relative", {
  variants: {
    tone: {
      paper: "bg-paper text-ink",
      canvas: "bg-canvas text-ink",
      board: "bg-board text-ink",
      ink: "bg-ink text-paper",
      yellow: "bg-yellow text-ink",
    },
    spacing: {
      none: "",
      sm: "py-12 md:py-16",
      md: "py-16 md:py-24",
      lg: "py-24 md:py-32",
    },
  },
  defaultVariants: { tone: "paper", spacing: "md" },
});

export type SectionProps = ComponentProps<"section"> & VariantProps<typeof sectionVariants>;

/** Vertical rhythm + background tone for a page section. */
export function Section({ className, tone, spacing, ...props }: SectionProps) {
  return <section className={cn(sectionVariants({ tone, spacing }), className)} {...props} />;
}
