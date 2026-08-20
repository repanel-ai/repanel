import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FieldRow, Fields } from "./fields";

describe("Fields", () => {
  /**
   * The pairing is in the markup, not only in the columns: a screen reader
   * reads "Email, ada@example.com" without being told how the grid was laid out.
   */
  it("pairs each label with its value in a description list", () => {
    const { container } = render(
      <Fields>
        <FieldRow label="Email">ada@example.com</FieldRow>
        <FieldRow label="Name">Ada</FieldRow>
      </Fields>,
    );

    expect(container.querySelector("dl")).not.toBeNull();
    expect([...container.querySelectorAll("dt")].map((term) => term.textContent)).toEqual([
      "Email",
      "Name",
    ]);
    expect(screen.getByText("ada@example.com").tagName).toBe("DD");
  });
});
