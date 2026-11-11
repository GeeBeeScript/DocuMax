"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { FaqItem } from "@/content/types";
import { cn } from "@/lib/utils";

/** FAQ accordion (Base UI: keyboard + ARIA handled). */
export function Faq({ items, className }: { items: readonly FaqItem[]; className?: string }) {
  return (
    <Accordion className={cn("mx-auto max-w-3xl", className)}>
      {items.map((item) => (
        <AccordionItem key={item.question} value={item.question} className="border-gray-200">
          <AccordionTrigger className="py-6 font-heading text-lg font-semibold hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="pb-6 text-base text-muted-foreground">{item.answer}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
