import type { ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const formAlertVariants = cva("rounded-xl px-4 py-3 text-sm", {
  variants: {
    tone: {
      danger: "bg-danger-soft text-danger",
      success: "bg-success-soft text-success",
      info: "bg-yellow-soft text-ink",
    },
  },
});

/** Form-level message (action errors, "check your email"). Announced to screen readers. */
export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: "danger" | "success" | "info";
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={cn(formAlertVariants({ tone }), className)}>
      {children}
    </p>
  );
}
