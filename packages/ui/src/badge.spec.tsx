import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders the state it is given", () => {
    render(<Badge>Active</Badge>);

    expect(screen.getByText("Active")).toBeDefined();
  });

  it("is neutral unless something that knows the domain said otherwise", () => {
    render(<Badge>Pending</Badge>);

    expect(screen.getByText("Pending").dataset.tone).toBe("neutral");
  });

  it("carries the tone it was given", () => {
    render(<Badge tone="critical">Suspended</Badge>);

    expect(screen.getByText("Suspended").dataset.tone).toBe("critical");
  });

  it("draws every tone in its own colours, and in one geometry", () => {
    render(
      <>
        <Badge tone="positive">a</Badge>
        <Badge tone="attention">b</Badge>
      </>,
    );

    const shared = "rounded-md border px-[7px] py-px";
    expect(screen.getByText("a").className).toContain("bg-positive-soft");
    expect(screen.getByText("b").className).toContain("bg-attention-soft");
    for (const state of ["a", "b"]) expect(screen.getByText(state).className).toContain(shared);
  });
});
