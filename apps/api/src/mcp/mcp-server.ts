import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AgentPrincipal } from "../auth/principal";
import { registerTools, type ToolDependencies } from "./mcp-tools";

const SERVER_NAME = "repanel";

/** The tool contract's own version, bumped when what the tools promise changes. */
const SERVER_VERSION = "0.1.0";

/**
 * Read by the connecting agent before it calls anything, so it says how the
 * tools fit together rather than what each one does.
 */
const INSTRUCTIONS = `Author the RePanel admin definition for the project this token is scoped to.
Inspect the customer's application and database first, then read get_schema_documentation, then
get_definition if a draft already exists. Submit with submit_definition: it replaces the whole
draft, so send the complete definition object every time. Invalid submissions are stored and
answered with every problem found — repair them and submit again until the definition is valid.`;

/** The server one agent talks to, with the tools it may reach and nothing else. */
export function createMcpServer(agent: AgentPrincipal, deps: ToolDependencies): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  registerTools(server, agent, deps);
  return server;
}
