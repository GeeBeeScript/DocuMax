import type { LegalDocument } from "@/content/legal";
import { MarketingSection } from "./marketing-section";

/** Terms / privacy layout: title, last updated, optional draft notice, numbered sections. */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <MarketingSection spacing="md" className="pt-12 md:pt-20">
      <article className="mx-auto flex max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight">{doc.title}</h1>
          <p className="text-sm text-muted-foreground">Last updated {doc.updated}</p>
          {doc.draftNotice && (
            <p role="note" className="rounded-xl bg-yellow-soft px-4 py-3 text-sm font-semibold text-ink">
              {doc.draftNotice}
            </p>
          )}
          <p className="text-lg text-ink-soft">{doc.intro}</p>
        </header>
        {doc.sections.map((section, i) => (
          <section key={section.heading} className="flex flex-col gap-2">
            <h2 className="font-heading text-xl font-bold">
              {i + 1}. {section.heading}
            </h2>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 40)} className="text-ink-soft">
                {p}
              </p>
            ))}
          </section>
        ))}
      </article>
    </MarketingSection>
  );
}
