import Link from "next/link";
import { Quote } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import type { TestimonialContent } from "@/content/types";
import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

/** Centered pull quote with attribution. */
export function Testimonial({ content, className }: { content: TestimonialContent; className?: string }) {
  const { quote, name, role, company, link } = content;
  return (
    <Reveal className={cn("mx-auto flex max-w-3xl flex-col items-center gap-6 text-center", className)}>
      <Quote aria-hidden className="size-10 fill-yellow text-yellow" />
      <blockquote className="font-heading text-2xl leading-snug font-semibold text-balance md:text-3xl">
        “{quote}”
      </blockquote>
      <figcaption className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-11 items-center justify-center rounded-full bg-note-blue font-heading font-bold"
        >
          {initials(name)}
        </span>
        <span className="text-left">
          <span className="block font-semibold">{name}</span>
          <span className="block text-sm text-muted-foreground">
            {role}, {company}
          </span>
        </span>
      </figcaption>
      {link && (
        <Link href={link.href} className="font-semibold underline underline-offset-4">
          {link.label}
        </Link>
      )}
    </Reveal>
  );
}
