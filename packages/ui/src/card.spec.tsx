import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./card";

describe("Card", () => {
  it("renders what it is given", () => {
    render(<Card>Connection</Card>);

    expect(screen.getByText("Connection")).toBeDefined();
  });
});
