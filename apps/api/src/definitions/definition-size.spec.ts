import { ROOT_PATH } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { ValidationFailedError } from "../errors/domain-errors";
import { MAX_PAYLOAD_BYTES, requirePayloadWithinLimit } from "./definition-size";

/** The refusal a payload earned; fails the test if it was let through. */
function refusalFor(payload: unknown): ValidationFailedError {
  try {
    requirePayloadWithinLimit(payload);
  } catch (error) {
    return error as ValidationFailedError;
  }
  throw new Error("expected the payload to be refused");
}

describe("requirePayloadWithinLimit", () => {
  it("lets a real definition through untouched", () => {
    expect(() => requirePayloadWithinLimit(saasDefinition)).not.toThrow();
  });

  it("lets a payload of exactly the limit through", () => {
    // Two quotes of JSON plus the characters lands on the limit exactly.
    expect(() => requirePayloadWithinLimit("x".repeat(MAX_PAYLOAD_BYTES - 2))).not.toThrow();
  });

  it("refuses a payload over the limit", () => {
    expect(refusalFor({ note: "x".repeat(MAX_PAYLOAD_BYTES) })).toBeInstanceOf(
      ValidationFailedError,
    );
  });

  it("measures bytes rather than characters", () => {
    // Half the limit in characters, but each one costs two bytes.
    const twoBytesEach = "é".repeat(MAX_PAYLOAD_BYTES / 2);

    expect(twoBytesEach.length).toBeLessThan(MAX_PAYLOAD_BYTES);
    expect(refusalFor(twoBytesEach)).toBeInstanceOf(ValidationFailedError);
  });

  it("tells the agent where the problem is, what was expected, and what to do", () => {
    const refusal = refusalFor({ note: "x".repeat(MAX_PAYLOAD_BYTES) });

    expect(refusal.details).toHaveLength(1);
    const [problem] = refusal.details;
    expect(Object.keys(problem ?? {}).sort()).toEqual(["expected", "hint", "message", "path"]);
    expect(problem?.path).toBe(ROOT_PATH);
    expect(problem?.message).toContain(String(MAX_PAYLOAD_BYTES));
  });

  it("does not offer a bigger limit as the fix", () => {
    // Decision 015: a hint suggests safe repairs, never lifting the guard.
    expect(refusalFor({ note: "x".repeat(MAX_PAYLOAD_BYTES) }).details[0]?.hint).not.toMatch(
      /raise|increase|larger limit/i,
    );
  });

  it("leaves a payload that is not JSON at all to validation", () => {
    expect(() => requirePayloadWithinLimit(undefined)).not.toThrow();
  });
});
