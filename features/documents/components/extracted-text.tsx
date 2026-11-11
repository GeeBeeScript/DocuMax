import { ScanText } from "lucide-react";
import { EmptyState } from "@/components/app/empty-state";
import { PageSourceBadge } from "@/components/app/page-source-badge";
import { documentsCopy } from "@/content/app";
import { confidenceBand } from "@/lib/documents/status";
import type { DocumentPageText } from "../queries";

/** Per-page extracted text with its source (text layer / OCR + confidence). */
export function ExtractedText({ pages }: { pages: DocumentPageText[] }) {
  const copy = documentsCopy.text;
  if (pages.length === 0) {
    return <EmptyState icon={ScanText} title={copy.pending.title} description={copy.pending.description} />;
  }
  return (
    <ol className="flex flex-col gap-6">
      {pages.map((page) => (
        <li key={page.pageNo} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading font-bold">{copy.page(page.pageNo)}</h3>
            <PageSourceBadge source={page.source} confidence={page.ocrConfidence} labels={copy.sources} />
          </div>
          {page.source === "ocr" &&
            page.ocrConfidence !== null &&
            confidenceBand(page.ocrConfidence) === "low" && (
              <p className="text-xs text-danger">{copy.lowConfidence}</p>
            )}
          {page.text ? (
            <pre className="max-h-[32rem] overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink">
              {page.text}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">{copy.emptyPage}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
