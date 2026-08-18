import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@nestjs/common";
import type { ValidationError } from "@repanel/contracts";
import { NotFoundError, ValidationFailedError } from "../errors/domain-errors";
import { runTool, toolFailure, toolResult, toolText } from "./tool-result";

const TOO_LARGE: ValidationError = {
  path: "(root)",
  message: "The definition is 2000000 bytes, over the 1048576 byte limit.",
  expected: "a definition of at most 1048576 bytes",
  hint: "Submit the definition on its own.",
};

/** The text a result carries, whatever else is on it. */
function textOf(result: CallToolResult): string {
  return result.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
}

describe("toolResult", () => {
  it("answers on both channels: structure to parse, text to read", () => {
    const result = toolResult({ status: "valid" });

    expect(result.structuredContent).toEqual({ status: "valid" });
    expect(textOf(result)).toBe('{\n  "status": "valid"\n}');
    expect(result.isError).toBeUndefined();
  });

  it("prints what it is given when the payload does not read well as JSON", () => {
    const result = toolResult({ valid: false, errorCount: 1 }, "The definition is invalid.");

    expect(textOf(result)).toBe("The definition is invalid.");
    expect(result.structuredContent).toEqual({ valid: false, errorCount: 1 });
  });
});

describe("toolText", () => {
  it("answers with prose and no structure to mirror it", () => {
    const result = toolText("# RePanel definition schema");

    expect(textOf(result)).toBe("# RePanel definition schema");
    expect(result.structuredContent).toBeUndefined();
  });
});

describe("toolFailure", () => {
  it("marks the answer as a refusal", () => {
    const result = toolFailure("Project not found");

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Project not found");
  });
});

describe("runTool", () => {
  const logged: string[] = [];
  const logger = { error: (message: string) => logged.push(message) } as unknown as Logger;

  beforeEach(() => {
    logged.length = 0;
  });

  it("hands back what the tool answered", async () => {
    const answer = toolResult({ status: "none" });

    await expect(runTool(logger, () => Promise.resolve(answer))).resolves.toBe(answer);
    expect(logged).toEqual([]);
  });

  it("turns a refused submission into a report the agent can act on", async () => {
    const refusal = new ValidationFailedError("Definition is too large", [TOO_LARGE]);

    const result = await runTool(logger, () => Promise.reject(refusal));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain("Definition is too large");
    expect(textOf(result)).toContain(TOO_LARGE.hint);
    expect(textOf(result)).toContain("1 problem, listed below");
  });

  it("passes a domain refusal on in its own words", async () => {
    const refusal = new NotFoundError("Project not found");

    const result = await runTool(logger, () => Promise.reject(refusal));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Project not found");
    expect(logged).toEqual([]);
  });

  it("keeps an unexpected failure to itself, and logs it", async () => {
    const outage = new Error("connect ECONNREFUSED 127.0.0.1:5432");

    const result = await runTool(logger, () => Promise.reject(outage));

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe("Internal error");
    expect(textOf(result)).not.toContain("ECONNREFUSED");
    expect(logged).toEqual(["Unhandled tool failure"]);
  });
});
