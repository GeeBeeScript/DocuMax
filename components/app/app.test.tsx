import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConfidencePill } from "@/components/app/confidence-pill";
import { StatusBadge } from "@/components/app/status-badge";
import { confidenceBand, DOCUMENT_STATUSES, DOCUMENT_STATUS_META } from "@/lib/documents/status";

describe("StatusBadge", () => {
  it.each(DOCUMENT_STATUSES)("renders the %s label", (status) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(DOCUMENT_STATUS_META[status].label)).toBeInTheDocument();
  });
});

describe("ConfidencePill", () => {
  it("renders a rounded percentage with band styling", () => {
    render(<ConfidencePill score={0.724} />);
    const pill = screen.getByText("72%");
    expect(pill).toHaveAttribute("title", "medium confidence");
  });
});

describe("confidenceBand", () => {
  it.each([
    [0.95, "high"],
    [0.85, "high"],
    [0.84, "medium"],
    [0.6, "medium"],
    [0.59, "low"],
  ] as const)("%f → %s", (score, band) => {
    expect(confidenceBand(score)).toBe(band);
  });

  it("respects a custom threshold", () => {
    expect(confidenceBand(0.9, 0.95)).toBe("medium");
  });
});
