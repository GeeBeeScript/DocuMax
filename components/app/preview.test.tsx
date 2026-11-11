import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DocumentPreview } from "./document-preview";
import { ImageViewer } from "./image-viewer";
import { LiveRegion } from "./live-region";

vi.mock("next/dynamic", () => ({
  default: () => (props: { url: string }) => <div data-testid="pdf-viewer">{props.url}</div>,
}));

const labels = {
  loading: "Loading…",
  error: "Couldn't load",
  unavailable: "No preview for this type",
  page: (n: number, t: number) => `Page ${n} of ${t}`,
  thumbnails: "Pages",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  resetZoom: "Reset zoom",
};

describe("DocumentPreview", () => {
  it("uses the pdf.js viewer for PDFs", () => {
    render(
      <DocumentPreview url="https://s/a.pdf" mimeType="application/pdf" fileName="a.pdf" labels={labels} />,
    );
    expect(screen.getByTestId("pdf-viewer")).toHaveTextContent("https://s/a.pdf");
  });

  it("shows browser images in the zoomable viewer", () => {
    render(
      <DocumentPreview url="https://s/r.jpg" mimeType="image/jpeg" fileName="receipt.jpg" labels={labels} />,
    );
    expect(screen.getByRole("img", { name: "receipt.jpg" })).toHaveAttribute("src", "https://s/r.jpg");
  });

  it("falls back for HEIC and when there is no URL", () => {
    const { rerender } = render(
      <DocumentPreview url="https://s/p.heic" mimeType="image/heic" fileName="p.heic" labels={labels} />,
    );
    expect(screen.getByText("No preview for this type")).toBeInTheDocument();
    rerender(<DocumentPreview url={null} mimeType="application/pdf" fileName="a.pdf" labels={labels} />);
    expect(screen.getByText("Couldn't load")).toBeInTheDocument();
  });
});

describe("ImageViewer", () => {
  it("zooms in and out within bounds and resets", () => {
    render(<ImageViewer url="https://s/r.png" alt="Receipt" labels={labels} />);
    const img = screen.getByRole("img", { name: "Receipt" });
    expect(img).toHaveStyle({ width: "100%" });
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(img).toHaveStyle({ width: "150%" });
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(img).toHaveStyle({ width: "50%" });
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  });
});

it("LiveRegion is a polite status region", () => {
  render(<LiveRegion message="a.pdf: Ready" />);
  expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  expect(screen.getByRole("status")).toHaveTextContent("a.pdf: Ready");
});
