import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BoardCanvas } from "@/components/brand/board-canvas";
import { CollabCursor } from "@/components/brand/collab-cursor";
import { Container } from "@/components/brand/section";
import { Logo } from "@/components/brand/logo";
import { PillButton } from "@/components/brand/pill-button";
import { SectionHeading } from "@/components/brand/section-heading";
import { StickyNote } from "@/components/brand/sticky-note";
import { YellowMarker } from "@/components/brand/yellow-marker";
import { ConfidencePill } from "@/components/app/confidence-pill";
import { StatusBadge } from "@/components/app/status-badge";
import { ExtractedFieldsMock } from "@/components/marketing/visuals/extracted-fields-mock";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { InvoiceMock } from "@/components/marketing/visuals/invoice-mock";
import { ReviewMock } from "@/components/marketing/visuals/review-mock";
import { StatementMock } from "@/components/marketing/visuals/statement-mock";
import { UploadMock } from "@/components/marketing/visuals/upload-mock";
import { demoFields, demoInvoice, demoIssues, demoStatement, demoUploads } from "@/content/demo";
import { features } from "@/content/marketing";
import { DOCUMENT_STATUSES } from "@/lib/documents/status";

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const swatches = [
  ["yellow", "bg-yellow"],
  ["yellow-hover", "bg-yellow-hover"],
  ["yellow-soft", "bg-yellow-soft"],
  ["ink", "bg-ink"],
  ["ink-soft", "bg-ink-soft"],
  ["paper", "bg-paper"],
  ["canvas", "bg-canvas"],
  ["note-yellow", "bg-note-yellow"],
  ["note-blue", "bg-note-blue"],
  ["note-pink", "bg-note-pink"],
  ["note-green", "bg-note-green"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
] as const;

function Block({ title, path, children }: { title: string; path: string; children: ReactNode }) {
  return (
    <section className="border-t border-gray-200 py-12">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">{title}</h2>
        <code className="text-xs text-muted-foreground">{path}</code>
      </div>
      {children}
    </section>
  );
}

/** Internal living style guide (noindex). Every reusable component should appear here. */
export default function DesignPage() {
  return (
    <Container size="wide" className="py-12">
      <div className="flex items-center justify-between">
        <Logo />
        <PillButton href="/" variant="outline" size="sm">
          Back to site
        </PillButton>
      </div>
      <SectionHeading
        as="h1"
        className="mt-12 mb-8"
        eyebrow="Internal"
        title={
          <>
            DocuMax <YellowMarker>design system</YellowMarker>
          </>
        }
        description="Tokens and components. See docs/DESIGN_SYSTEM.md for usage rules."
      />

      <Block title="Color tokens" path="app/globals.css">
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {swatches.map(([name, cls]) => (
            <li key={name} className="flex flex-col gap-2">
              <span className={`h-16 rounded-xl border border-gray-200 ${cls}`} />
              <span className="font-mono text-xs">{name}</span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Typography" path="font-heading / font-sans">
        <div className="flex flex-col gap-4">
          <p className="font-heading text-display-xl font-extrabold">Display XL</p>
          <p className="font-heading text-display-lg font-bold">Display LG</p>
          <p className="font-heading text-display-md font-bold">Display MD</p>
          <p className="text-lg">Body large — Noto Sans for readable paragraphs and UI copy.</p>
          <p className="text-sm text-muted-foreground">Small muted — captions and helper text.</p>
        </div>
      </Block>

      <Block title="PillButton" path="components/brand/pill-button.tsx">
        <div className="flex flex-wrap items-center gap-3">
          <PillButton>Primary</PillButton>
          <PillButton variant="yellow">Yellow</PillButton>
          <PillButton variant="outline">Outline</PillButton>
          <PillButton variant="ghost">Ghost</PillButton>
          <span className="rounded-full bg-ink p-2">
            <PillButton variant="inverse">Inverse</PillButton>
          </span>
          <PillButton size="sm">Small</PillButton>
          <PillButton size="lg">Large</PillButton>
        </div>
      </Block>

      <Block title="Board, sticky notes & cursors" path="components/brand">
        <BoardCanvas framed className="relative flex flex-wrap items-center gap-6 p-8">
          {(["yellow", "blue", "pink", "green", "paper"] as const).map((c) => (
            <StickyNote key={c} color={c} className="w-36 text-sm">
              {c}
            </StickyNote>
          ))}
          <CollabCursor label="Maya" color="yellow" />
          <CollabCursor label="Leo" color="ink" />
        </BoardCanvas>
      </Block>

      <Block title="Status & confidence" path="components/app">
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <ConfidencePill score={0.98} />
          <ConfidencePill score={0.74} />
          <ConfidencePill score={0.41} />
        </div>
      </Block>

      <Block title="Product mockups" path="components/marketing/visuals">
        <BoardCanvas framed className="flex flex-wrap items-start justify-center gap-8 p-8">
          <InvoiceMock {...demoInvoice} />
          <ExtractedFieldsMock fields={demoFields} />
          <UploadMock files={demoUploads} />
          <ReviewMock fields={demoFields.slice(0, 3)} issues={demoIssues} />
          <StatementMock {...demoStatement} />
        </BoardCanvas>
      </Block>

      <Block title="FeatureGrid" path="components/marketing/feature-grid.tsx">
        <FeatureGrid items={features.items.slice(0, 3)} />
      </Block>
    </Container>
  );
}
