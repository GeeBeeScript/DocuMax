import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const textFieldInputVariants = cva("", {
  variants: {
    size: {
      default: "h-10 px-3",
      lg: "h-12 rounded-xl px-4",
    },
  },
  defaultVariants: { size: "default" },
});

export type TextFieldProps = Omit<ComponentProps<typeof Input>, "size"> &
  VariantProps<typeof textFieldInputVariants> & {
    id: string;
    label: string;
    error?: string;
    hint?: string;
  };

/** Label + input + hint/error, wired for accessibility (aria-invalid, aria-describedby). */
export function TextField({ id, label, error, hint, size, className, ...inputProps }: TextFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={textFieldInputVariants({ size })}
        {...inputProps}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
