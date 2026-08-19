import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it("renders the state it is given", () => {
    render(<Badge>Active</Badge>);

    expect(screen.getByText("Active")).toBeDefined();
  });

  it("is quiet unless something asked for another treatment", () => {
    render(<Badge>Pending</Badge>);

    expect(screen.getByText("Pending").dataset.treatment).toBe("quiet");
  });

  it("carries the treatment it was asked for", () => {
    render(<Badge treatment="tinted">Suspended</Badge>);

    expect(screen.getByText("Suspended").dataset.treatment).toBe("tinted");
  });
});
