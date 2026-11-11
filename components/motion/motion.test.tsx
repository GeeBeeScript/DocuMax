import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FadeSwap } from "@/components/motion/fade-swap";
import { Float } from "@/components/motion/float";
import { HoverLift } from "@/components/motion/hover-lift";
import { Stagger, StaggerItem } from "@/components/motion/stagger";

describe("motion wrappers", () => {
  it("Stagger renders the requested element with items", () => {
    render(
      <Stagger as="ul">
        <StaggerItem as="li">One</StaggerItem>
        <StaggerItem as="li">Two</StaggerItem>
      </Stagger>,
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("Stagger items carry the reduced-motion marker", () => {
    const { container } = render(
      <Stagger>
        <StaggerItem>a</StaggerItem>
      </Stagger>,
    );
    expect(container.querySelector("[data-reveal]")).toHaveTextContent("a");
  });

  it("HoverLift, Float and FadeSwap render children", () => {
    render(
      <>
        <HoverLift>lift</HoverLift>
        <Float>float</Float>
        <FadeSwap swapKey="a">swap</FadeSwap>
      </>,
    );
    for (const t of ["lift", "float", "swap"]) expect(screen.getByText(t)).toBeInTheDocument();
  });
});
