import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { PageSourceBadge } from "@/components/app/page-source-badge";
import { ExtractedText } from "./extracted-text";

const labels = { textLayer: "Text layer", ocr: "OCR" };

describe("PageSourceBadge", () => {
  it("labels text-layer pages without a score", () => {
    render(<PageSourceBadge source="text_layer" confidence={null} labels={labels} />);
    expect(screen.getByText("Text layer")).toHaveClass("bg-gray-100");
  });

  it.each([
    [0.93, "93%", "bg-success-soft"],
    [0.7, "70%", "bg-yellow-soft"],
    [0.41, "41%", "bg-danger-soft"],
  ])("OCR %s → %s with band color", (confidence, text, cls) => {
    render(<PageSourceBadge source="ocr" confidence={confidence} labels={labels} />);
    const badge = screen.getByText(text).parentElement!;
    expect(badge).toHaveTextContent(`OCR · ${text}`);
    expect(badge).toHaveClass(cls);
  });
});

describe("ExtractedText", () => {
  it("shows a pending state before extraction", () => {
    render(<ExtractedText pages={[]} />);
    expect(screen.getByRole("heading", { name: "Text not extracted yet" })).toBeInTheDocument();
  });

  it("renders each page with its source, text and a low-confidence warning", () => {
    render(
      <ExtractedText
        pages={[
          {
            pageNo: 1,
            text: "Invoice INV-2041\nTotal due 1260.57",
            source: "text_layer",
            ocrConfidence: null,
          },
          { pageNo: 2, text: "blurry", source: "ocr", ocrConfidence: 0.42 },
          { pageNo: 3, text: "", source: "ocr", ocrConfidence: 0.95 },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByRole("heading", { name: "Page 1" })).toBeInTheDocument();
    expect(within(items[0]).getByText(/Total due 1260\.57/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/Low OCR confidence/)).toBeInTheDocument();
    expect(within(items[2]).getByText("No text found on this page.")).toBeInTheDocument();
    expect(within(items[2]).queryByText(/Low OCR confidence/)).toBeNull();
  });
});
