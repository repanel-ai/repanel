import { describe, expect, it } from "vitest";
import { cn } from "./class-names";

describe("cn", () => {
  it("lets the caller's utility win over the component's", () => {
    expect(cn("rounded-md bg-primary", "rounded-none")).toBe("bg-primary rounded-none");
  });

  it("drops falsy entries so a conditional class reads as one", () => {
    expect(cn("text-sm", false && "hidden", undefined)).toBe("text-sm");
  });
});
