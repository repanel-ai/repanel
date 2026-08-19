import { describe, expect, it } from "vitest";
import { cn } from "./class-names";

describe("cn", () => {
  it("lets the caller's utility win over the component's", () => {
    expect(cn("rounded-md bg-primary", "rounded-none")).toBe("bg-primary rounded-none");
  });

  /**
   * The type scale's names are the project's own, and tailwind-merge reads an
   * unknown `text-*` as a colour. Without being told otherwise it would drop
   * every size the design record fixes the moment a colour follows it.
   */
  it("keeps a size and a colour, which answer different questions", () => {
    expect(cn("text-micro font-medium", "text-secondary-foreground")).toBe(
      "text-micro font-medium text-secondary-foreground",
    );
  });

  it("still lets one size replace another", () => {
    expect(cn("text-body", "text-title")).toBe("text-title");
  });

  it("drops falsy entries so a conditional class reads as one", () => {
    expect(cn("text-sm", false && "hidden", undefined)).toBe("text-sm");
  });
});
