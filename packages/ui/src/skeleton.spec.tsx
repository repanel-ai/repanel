import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  /**
   * A screen full of placeholder blocks has nothing to say to a screen reader;
   * the surface that is waiting announces the wait once, in words.
   */
  it("is invisible to assistive technology", () => {
    const { container } = render(<Skeleton className="w-24" />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});
