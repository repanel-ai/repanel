import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Relation } from "./relation";

describe("Relation", () => {
  it("renders the label the other record is known by", () => {
    render(<Relation>Northwind Labs</Relation>);

    expect(screen.getByText("Northwind Labs")).toBeDefined();
  });

  /**
   * The dotted rule is the product's signature and the one place it is
   * declared. A relation that lost it would be indistinguishable from a value
   * this record owns, which is the whole of what the mark says.
   */
  it("carries the dotted signature", () => {
    render(<Relation>Ridgeline</Relation>);

    expect(screen.getByText("Ridgeline").className).toContain("decoration-dotted");
  });
});
