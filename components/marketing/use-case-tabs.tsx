"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PillButton } from "@/components/brand/pill-button";
import { FadeSwap } from "@/components/motion/fade-swap";
import type { UseCaseTab } from "@/content/types";
import { cn } from "@/lib/utils";
import { CheckList } from "./check-list";
import { ShowcaseVisual } from "./visuals/showcase-visual";

/**
 * Tabbed workflow showcase: pill tabs, then copy (heading, checklist, link) beside a board visual
 * that crossfades on change. Base UI Tabs provides ARIA; arrow keys move and activate (panels
 * render instantly, so automatic activation is the recommended WAI-ARIA pattern).
 */
export function UseCaseTabs({ tabs, className }: { tabs: readonly UseCaseTab[]; className?: string }) {
  const [active, setActive] = useState(tabs[0]?.id);

  return (
    <Tabs value={active} onValueChange={(v) => setActive(String(v))} className={cn("gap-10", className)}>
      <TabsList
        activateOnFocus
        className="mx-auto h-auto flex-wrap justify-center gap-2 rounded-full bg-gray-100 p-1.5 group-data-horizontal/tabs:h-auto"
      >
        {tabs.map((t, i) => (
          <TabsTrigger
            key={t.id}
            value={t.id}
            className="h-10 flex-none rounded-full px-5 font-heading text-sm font-semibold text-ink-soft data-active:bg-ink data-active:text-paper data-active:shadow-none"
          >
            <span className="mr-1 text-xs tabular-nums">{String(i + 1).padStart(2, "0")}</span>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id} className="text-base">
          <FadeSwap swapKey={t.id} className="grid items-center gap-10 lg:grid-cols-[2fr_3fr]">
            <div className="flex flex-col items-start gap-5">
              <h3 className="text-3xl font-bold text-balance">{t.heading}</h3>
              <CheckList items={t.bullets} />
              <PillButton href={t.link.href} variant="outline">
                {t.link.label}
              </PillButton>
            </div>
            <ShowcaseVisual kind={t.visual} />
          </FadeSwap>
        </TabsContent>
      ))}
    </Tabs>
  );
}
