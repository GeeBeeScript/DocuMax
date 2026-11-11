import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BoardCanvas } from "@/components/brand/board-canvas";
import { Logo } from "@/components/brand/logo";
import { PillButton } from "@/components/brand/pill-button";
import { SectionHeading } from "@/components/brand/section-heading";
import { StickyNote } from "@/components/brand/sticky-note";
import { YellowMarker } from "@/components/brand/yellow-marker";

describe("PillButton", () => {
  it("renders a button by default with type=button", () => {
    render(<PillButton>Start free</PillButton>);
    const btn = screen.getByRole("button", { name: "Start free" });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn.className).toContain("bg-ink");
  });

  it("renders a link when href is given", () => {
    render(
      <PillButton href="/pricing" variant="yellow">
        Pricing
      </PillButton>,
    );
    const link = screen.getByRole("link", { name: "Pricing" });
    expect(link).toHaveAttribute("href", "/pricing");
    expect(link.className).toContain("bg-yellow");
  });
});

describe("StickyNote", () => {
  it("applies color and tilt variants", () => {
    render(
      <StickyNote color="pink" tilt="left">
        Note
      </StickyNote>,
    );
    const note = screen.getByText("Note");
    expect(note.className).toContain("bg-note-pink");
    expect(note.className).toContain("-rotate-2");
  });
});

describe("BoardCanvas", () => {
  it("adds frame classes when framed", () => {
    render(<BoardCanvas framed data-testid="board" />);
    expect(screen.getByTestId("board").className).toMatch(/bg-board.*rounded-3xl/);
  });
});

describe("YellowMarker", () => {
  it("wraps text in a marker span", () => {
    render(<YellowMarker>checked</YellowMarker>);
    expect(screen.getByText("checked").className).toContain("marker-yellow");
  });
});

describe("Logo", () => {
  it("shows the wordmark by default", () => {
    render(<Logo />);
    expect(screen.getByText("DocuMax")).toBeInTheDocument();
  });

  it("exposes an accessible name when mark-only", () => {
    render(<Logo markOnly />);
    expect(screen.getByRole("img", { name: "DocuMax" })).toBeInTheDocument();
  });
});

describe("SectionHeading", () => {
  it("renders eyebrow, title at the chosen level, and description", () => {
    render(<SectionHeading as="h1" eyebrow="Why DocuMax" title="Less typing" description="Lead copy" />);
    expect(screen.getByText("Why DocuMax")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Less typing" })).toBeInTheDocument();
    expect(screen.getByText("Lead copy")).toBeInTheDocument();
  });
});

describe("Section & Container", () => {
  it("applies tone and spacing", async () => {
    const { Section, Container } = await import("@/components/brand/section");
    render(
      <Section tone="ink" spacing="lg" data-testid="s">
        <Container size="narrow">x</Container>
      </Section>,
    );
    expect(screen.getByTestId("s").className).toMatch(/bg-ink.*py-24/);
    expect(screen.getByText("x").className).toContain("max-w-3xl");
  });
});

describe("CollabCursor", () => {
  it("is decorative and shows its label", async () => {
    const { CollabCursor } = await import("@/components/brand/collab-cursor");
    const { container } = render(<CollabCursor label="Maya" color="yellow" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Maya")).toBeInTheDocument();
  });
});

describe("SegmentedToggle", () => {
  it("selects on click and moves with arrow keys", async () => {
    const { SegmentedToggle } = await import("@/components/brand/segmented-toggle");
    const { fireEvent } = await import("@testing-library/react");
    const { useState } = await import("react");
    function Harness() {
      const [v, setV] = useState<"a" | "b">("a");
      return (
        <SegmentedToggle
          aria-label="Choice"
          value={v}
          onValueChange={setV}
          options={[
            { value: "a", label: "A" },
            { value: "b", label: "B", badge: "Save" },
          ]}
        />
      );
    }
    render(<Harness />);
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: /B/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "A" }));
    expect(screen.getByRole("radio", { name: "A" })).toHaveAttribute("aria-checked", "true");
  });
});
