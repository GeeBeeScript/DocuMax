import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { StatTile } from "@/components/app/stat-tile";
import { entities, records } from "@/lib/calc/__fixtures__/statement-records";
import { monthPeriod } from "@/lib/calc/period";
import { buildStatement } from "@/lib/calc/statement";
import { EntityStatement } from "./entity-statement";
import { PeriodPicker } from "./period-picker";

const data = buildStatement({
  org: { name: "Org" },
  entity: entities[0]!,
  period: monthPeriod("2026-10"),
  currency: "USD",
  records,
  generatedAt: "",
});

describe("statement components", () => {
  it("StatTile shows a label and value", () => {
    render(<StatTile label="Total costs" value="$1.00" hint="hint" />);
    expect(screen.getByText("Total costs")).toBeInTheDocument();
    expect(screen.getByText("$1.00")).toBeInTheDocument();
  });

  it("EntityStatement renders the view-model's figures, categories and lines", () => {
    render(<EntityStatement data={data} />);
    expect(screen.getAllByText("$1,480.57")[0]).toBeInTheDocument(); // total costs
    const categories = screen.getByRole("list", { name: "Costs by category" });
    expect(within(categories).getByText("Labor & subcontractors")).toBeInTheDocument();
    expect(within(categories).getByText(/40\.94%/)).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Approved costs in this period" });
    expect(within(table).getAllByRole("row")).toHaveLength(1 + data.lines.length);
    expect(within(table).getAllByText("Split:").length).toBeGreaterThan(0); // the shared landscaping invoice
    expect(screen.getByText(/other currencies.*€15\.00/)).toBeInTheDocument();
  });

  it("PeriodPicker links to neighbouring months and shows the label", () => {
    render(<PeriodPicker basePath="/app/entities/x" period={monthPeriod("2026-01")} mode="month" />);
    expect(screen.getByText("January 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Previous month" })).toHaveAttribute(
      "href",
      "/app/entities/x?month=2025-12",
    );
    expect(screen.getByRole("link", { name: "Next month" })).toHaveAttribute(
      "href",
      "/app/entities/x?month=2026-02",
    );
  });
});
