import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JsonBlock } from "./json-block";

describe("JsonBlock", () => {
  it("stays closed, and says what shape the value is while it is", () => {
    render(<JsonBlock value={{ theme: "dark", beta: ["insights"] }} />);

    expect(screen.getByRole("group")).toHaveProperty("open", false);
    expect(screen.getByText('{"theme":"dark","beta":["insights"]}')).toBeDefined();
  });

  it("holds the value pretty-printed, for whoever opens it", () => {
    const { container } = render(<JsonBlock value={{ theme: "dark" }} />);

    expect(container.querySelector("pre")?.textContent).toBe('{\n  "theme": "dark"\n}');
  });

  /** `undefined` cannot survive `JSON.stringify`, and nothing may render blank. */
  it("draws something for a value JSON cannot write down", () => {
    const { container } = render(<JsonBlock value={undefined} />);

    expect(container.querySelector("pre")?.textContent).toBe("null");
  });
});
