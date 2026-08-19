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

  it("is the primary action unless it was asked to be quieter", () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole("button", { name: "Save" }).dataset.variant).toBe("primary");
  });

  it("carries the variant it was given", () => {
    render(<Button variant="outline">Refresh</Button>);

    expect(screen.getByRole("button", { name: "Refresh" }).dataset.variant).toBe("outline");
  });
});
