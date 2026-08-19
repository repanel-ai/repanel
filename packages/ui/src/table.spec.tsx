import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

describe("Table", () => {
  it("renders a table assistive technology can read as one", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>ada@example.com</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Email" })).toBeDefined();
    expect(screen.getByRole("cell", { name: "ada@example.com" })).toBeDefined();
  });
});
