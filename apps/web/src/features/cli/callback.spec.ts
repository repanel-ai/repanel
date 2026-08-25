import { describe, expect, it } from "vitest";
import { callbackUrl } from "./callback";

describe("callbackUrl", () => {
  it("hands the token back to the loopback port the CLI is listening on", () => {
    expect(callbackUrl("54321", "s-1", "tok")).toBe(
      "http://127.0.0.1:54321/?state=s-1&token=tok",
    );
  });

  it("escapes what it carries rather than pasting it", () => {
    expect(callbackUrl("54321", "a b/c", "t+k=")).toBe(
      "http://127.0.0.1:54321/?state=a+b%2Fc&token=t%2Bk%3D",
    );
  });

  it("refuses a port that is not a port, so nothing is delivered anywhere", () => {
    for (const port of [null, "", "0", "65536", "1.5", "evil.example.com", "80x"]) {
      expect(callbackUrl(port, "s-1", "tok")).toBeUndefined();
    }
  });

  it("refuses a host smuggled in where the port goes", () => {
    // The address is built from a fixed host and a number. Anything that tried
    // to make it name another machine has to come back as nothing.
    expect(callbackUrl("1234@evil.example.com", "s-1", "tok")).toBeUndefined();
    expect(callbackUrl("//evil.example.com", "s-1", "tok")).toBeUndefined();
  });

  it("refuses a request with no state to hand back", () => {
    expect(callbackUrl("54321", null, "tok")).toBeUndefined();
    expect(callbackUrl("54321", "", "tok")).toBeUndefined();
  });
});
