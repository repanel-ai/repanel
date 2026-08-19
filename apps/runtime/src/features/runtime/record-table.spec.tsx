import type { Resource } from "@repanel/contracts";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { orderRecords, resourceIn } from "./definition.fixture";
import { RecordTable } from "./record-table";

const orders = resourceIn("orders");

function renderTable(resource: Resource = orders) {
  const columns = resource.views.table.columns
    .map((key) => resource.fields.find((field) => field.key === key))
    .flatMap((field) => (field ? [field] : []));

  return render(
    <MemoryRouter>
      <RecordTable
        projectKey="acme"
        resource={resource}
        columns={columns}
        records={orderRecords}
        isPending={false}
        sort={{ field: "placed_at", direction: "desc" }}
        onSort={() => {}}
        onOpen={() => {}}
        empty={null}
      />
    </MemoryRouter>,
  );
}

/** Which side of its column a value sits on, and why (DESIGN.md §3). */
describe("RecordTable alignment", () => {
  it("sets a quantity against the right edge, and its column head with it", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: /Total/ }).className).toContain("text-right");
    const cell = within(screen.getByRole("table")).getByText("1,240,000").closest("td");
    expect(cell?.className).toContain("text-right");
  });

  it("leaves prose where prose goes", () => {
    renderTable();

    expect(screen.getByRole("columnheader", { name: /Reference/ }).className).not.toContain("text-right");
    expect(screen.getByText("AC-10241").closest("td")?.className).not.toContain("text-right");
  });

  /**
   * An id is a name that happens to be digits: it is never summed and never
   * compared with the ids above it, so lining up its digits would be lining up
   * nothing. It is also why `RecordCell` gives it no thousands separators.
   */
  it("leaves a number that addresses the record where names go", () => {
    const addressedByNumber: Resource = { ...orders, primaryKey: "total_cents" };
    renderTable(addressedByNumber);

    expect(screen.getByRole("columnheader", { name: /Total/ }).className).not.toContain("text-right");
    expect(screen.getByText("1240000").closest("td")?.className).not.toContain("text-right");
  });
});
