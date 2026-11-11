import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { DataTable } from "./data-table";
import { ViewToggle } from "./view-toggle";

describe("DataTable", () => {
  const rows = [
    { id: "1", name: "Elm", total: 3 },
    { id: "2", name: "Oak", total: 10 },
  ];

  it("renders a captioned table with row headers and cells", () => {
    render(
      <DataTable
        caption="Properties"
        rows={rows}
        getRowKey={(r) => r.id}
        columns={[
          { key: "name", header: "Name", rowHeader: true, cell: (r) => r.name },
          { key: "total", header: "Docs", align: "right", hideOnMobile: true, cell: (r) => r.total },
        ]}
      />,
    );
    const table = screen.getByRole("table", { name: "Properties" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["Name", "Docs"]);
    expect(within(table).getByRole("rowheader", { name: "Oak" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "10" })).toHaveClass(
      "text-right",
      "hidden",
      "md:table-cell",
    );
  });
});

describe("ViewToggle", () => {
  it("renders links and marks the current one", () => {
    render(
      <ViewToggle
        label="View"
        value="table"
        options={[
          { value: "grid", label: "Cards", href: "?view=grid" },
          { value: "table", label: "Table", href: "?view=table" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "View" });
    expect(within(nav).getByRole("link", { name: "Table" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Cards" })).not.toHaveAttribute("aria-current");
  });
});
