import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@nestjs/common";
import { DomainError, ValidationFailedError } from "../errors/domain-errors";
import { renderValidationReport } from "./validation-report";

/**
 * An answer: the payload a client parses, and the same thing written out for
 * the agent reading it. Both channels carry the whole truth; neither summarizes.
 */
export function toolResult(payload: Record<string, unknown>, text?: string): CallToolResult {
  return {
    content: [{ type: "text", text: text ?? JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

/** An answer that is prose all the way down, with no structure to mirror it. */
export function toolText(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

/** A refusal. The agent learns what it may fix, and nothing about our internals. */
export function toolFailure(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/**
 * Runs a tool, turning a refusal into a result rather than a protocol error:
 * an agent that can read what went wrong can act on it, and an agent that
 * cannot, cannot. Anything unrecognized is logged here and leaves as one line.
 */
export async function runTool(
  logger: Logger,
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ValidationFailedError) {
      return toolFailure(`${error.message}.\n\n${renderValidationReport(error.details)}`);
    }
    if (error instanceof DomainError) return toolFailure(error.message);

    logger.error("Unhandled tool failure", error instanceof Error ? error.stack : String(error));
    return toolFailure("Internal error");
  }
}
