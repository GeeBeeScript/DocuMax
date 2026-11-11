import Link from "next/link";
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const pillButtonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-heading font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] duration-200 ease-out-soft outline-none select-none focus-visible:ring-3 focus-visible:ring-ink/30 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Primary CTA — black pill, white text. */
        primary: "bg-ink text-paper hover:bg-ink-soft",
        /** Brand highlight CTA — use on dark or neutral backgrounds, max one per view. */
        yellow: "bg-yellow text-ink hover:bg-yellow-hover",
        outline: "border border-ink bg-transparent text-ink hover:bg-ink/5",
        ghost: "bg-transparent text-ink hover:bg-ink/5",
        /** For use on ink backgrounds. */
        inverse: "bg-paper text-ink hover:bg-gray-100",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-[0.9375rem]",
        lg: "h-14 px-8 text-base",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Variants = VariantProps<typeof pillButtonVariants>;

type ButtonProps = ComponentProps<"button"> & Variants & { href?: undefined };
type LinkProps = Omit<ComponentProps<typeof Link>, "href"> & Variants & { href: string };

/**
 * Primary DocuMax button. Renders a Next.js <Link> when `href` is given,
 * otherwise a <button>. For dense app UI (tables, toolbars) use components/ui/button.
 */
export function PillButton(props: ButtonProps | LinkProps) {
  if (props.href !== undefined) {
    const { className, variant, size, ...rest } = props;
    return <Link className={cn(pillButtonVariants({ variant, size }), className)} {...rest} />;
  }
  const { className, variant, size, type = "button", ...rest } = props;
  return <button type={type} className={cn(pillButtonVariants({ variant, size }), className)} {...rest} />;
}
