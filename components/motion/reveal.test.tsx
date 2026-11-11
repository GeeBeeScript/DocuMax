import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Reveal } from "./reveal";

describe("Reveal", () => {
  it("renders its children", () => {
    render(
      <Reveal className="wrapper">
        <p>Visible content</p>
      </Reveal>,
    );
    expect(screen.getByText("Visible content")).toBeInTheDocument();
  });

  it("marks itself for the reduced-motion CSS override", () => {
    const { container } = render(<Reveal>Hidden until revealed</Reveal>);
    // globals.css forces [data-reveal] visible under prefers-reduced-motion; the server can't know
    // the preference, so this marker (not a JS branch) is what keeps the content visible.
    expect(container.firstElementChild).toHaveAttribute("data-reveal");
  });
});
