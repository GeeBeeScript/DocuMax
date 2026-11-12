import { reportCopy } from "@/content/reports";
import { PAGE } from "../layout";

/**
 * Page footer (Chromium `footerTemplate`): footer text + generation date on the left, "Page X of Y" on the right —
 * Chromium fills the `pageNumber` / `totalPages` spans.
 */
export function PageFooter({ footerText, generated }: { footerText: string | null; generated: string }) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "space-between",
        gap: "6mm",
        padding: `0 ${PAGE.marginX}mm 4mm`,
        fontFamily: '"Helvetica Neue", Helvetica, Arial, "Liberation Sans", sans-serif',
        fontSize: "7.5pt",
        color: "#6b6b80",
      }}
    >
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {footerText ? `${footerText} · ` : ""}
        {generated}
      </span>
      <span style={{ whiteSpace: "nowrap" }}>
        {reportCopy.page} <span className="pageNumber" /> {reportCopy.of} <span className="totalPages" />
      </span>
    </div>
  );
}
