import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label and accepts the caller's classes", () => {
    render(<Button className="w-full">Sign in</Button>);

    const button = screen.getByRole("button", { name: "Sign in" });
    expect(button.className).toContain("w-full");
  });

  it("defaults to a plain button, so one inside a form never submits by accident", () => {
    render(<Button>Cancel</Button>);

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveProperty("type", "button");
  });
});
