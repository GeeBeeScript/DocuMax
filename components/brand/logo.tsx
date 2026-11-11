import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { siteConfig } from "@/content/site";

export type LogoProps = ComponentProps<"span"> & {
  /** Hide the wordmark (sidebar collapsed, favicons, PDFs with tight headers). */
  markOnly?: boolean;
};

/** DocuMax logo: yellow tile with a folded-corner document mark, plus wordmark. */
export function Logo({ markOnly = false, className, ...props }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ink", className)} {...props}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden={!markOnly} role="img">
        {markOnly && <title>{siteConfig.name}</title>}
        <rect width="32" height="32" rx="8" className="fill-yellow" />
        <path
          d="M10 7h8.5L23 11.5V25H10z"
          className="fill-paper stroke-ink"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M18 7v5h5" className="fill-none stroke-ink" strokeWidth="2" strokeLinejoin="round" />
        <path d="M13.5 17h6M13.5 20.5h4" className="stroke-ink" strokeWidth="2" strokeLinecap="round" />
      </svg>
      {!markOnly && (
        <span className="font-heading text-xl font-extrabold tracking-tight">{siteConfig.name}</span>
      )}
    </span>
  );
}
