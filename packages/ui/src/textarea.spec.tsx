import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a multi-line field the caller's attributes reach", () => {
    render(<Textarea defaultValue={"first\nsecond"} aria-label="Notes" />);

    const field = screen.getByLabelText("Notes");
    expect(field.tagName).toBe("TEXTAREA");
    expect(field).toHaveProperty("value", "first\nsecond");
  });
});
