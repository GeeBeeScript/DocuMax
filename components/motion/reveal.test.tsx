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
});
