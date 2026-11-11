import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/** Native select styled like our inputs (accessible, mobile-friendly). `label` may be visually hidden. */
export function SelectField({
  id,
  label,
  hideLabel = false,
  options,
  error,
  className,
  ...selectProps
}: Omit<ComponentProps<"select">, "children"> & {
  id: string;
  label: string;
  hideLabel?: boolean;
  options: readonly SelectOption[];
  error?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className={cn(hideLabel && "sr-only")}>
        {label}
      </Label>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          className="h-10 w-full appearance-none rounded-lg border border-input bg-paper pr-9 pl-3 text-sm text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          {...selectProps}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
