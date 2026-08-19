import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
  it("renders a field the caller's attributes reach", () => {
    render(<Input type="email" defaultValue="ada@example.com" aria-label="Email" />);

    expect(screen.getByLabelText("Email")).toHaveProperty("value", "ada@example.com");
  });
});
