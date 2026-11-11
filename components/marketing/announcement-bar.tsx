import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Link as LinkType } from "@/content/types";

/** Thin top-of-page announcement with an inline link. */
export function AnnouncementBar({ text, link }: { text: string; link: LinkType }) {
  return (
    <div className="bg-ink px-4 py-2.5 text-center text-sm text-paper">
      <span>{text}</span>{" "}
      <Link
        href={link.href}
        className="inline-flex items-center gap-1 font-semibold text-yellow underline-offset-4 hover:underline"
      >
        {link.label}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
