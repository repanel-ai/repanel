import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "@nestjs/common";
import type { ValidationError } from "@repanel/contracts";
import { z } from "zod";
import type { AgentPrincipal } from "../auth/principal";
import type { ConnectionsService } from "../connections/connections.service";
import type { StoredValidation } from "../definitions/definitions.mapper";
import type { DefinitionsService } from "../definitions/definitions.service";
import type { ProjectsService } from "../projects/projects.service";
import type { SchemaDocumentationService } from "./schema-documentation.service";
import { runTool, toolResult, toolText } from "./tool-result";
import { renderValidationReport } from "./validation-report";

/** What the tools need to answer. They own no state of their own. */
export interface ToolDependencies {
  projects: ProjectsService;
  connections: ConnectionsService;
  definitions: DefinitionsService;
  schemaDocumentation: SchemaDocumentationService;
  /** The console's origin, so a tool can send a human somewhere specific. */
  consoleUrl: string;
  logger: Logger;
}

/** No tool takes a project: the token names one, and that one is the only one. */
const NO_ARGUMENTS = {};

/** Locked to the contracts interface, so an error shape cannot drift silently. */
const validationErrorSchema: z.ZodType<ValidationError> = z.object({
  path: z.string(),
  message: z.string(),
  expected: z.string(),
  hint: z.string(),
});

const definitionStatusSchema = z.enum(["none", "invalid", "valid"]);

/**
 * Registers the tools an authoring agent works through. Names, descriptions
 * and shapes here are public contract: agents everywhere are prompted against
 * them, so they change the way a published API changes.
 *
 * They are also the floor, and the floor is sovereign. An agent with no skill
 * installed and no guide to hand must be able to author, submit and repair a
 * definition from these descriptions and the server instructions alone
 * (DECISIONS #021). `skills/repanel/` improves that; it never becomes a
 * prerequisite for it, so no description may be thinned on the grounds that
 * the skill says the same thing.
 */
export function registerTools(
  server: McpServer,
  agent: AgentPrincipal,
  deps: ToolDependencies,
): void {
  // The project comes from the token, never from a tool argument — and every
  // service below is still asked, because a guard is not an authorization.
  const { projectId } = agent;

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: `Read the RePanel project this connection is scoped to: its name, its
key, whether a customer database connection has been configured, and the state of its
definition. Call this first in a session — it tells you whether you are authoring a
definition from scratch or repairing one that already exists. Takes no arguments: the
access token fixes which project you are working on. When \`hasConnection\` is false the
result also carries \`connectionSetupUrl\`: send the human there to paste the connection
string themselves. Never ask for a connection string and never handle one.`,
      inputSchema: NO_ARGUMENTS,
      outputSchema: {
        name: z.string(),
        key: z.string(),
        hasConnection: z.boolean(),
        /** Where a human configures the connection, or null once one exists. */
        connectionSetupUrl: z.string().nullable(),
        definitionStatus: definitionStatusSchema,
        /** ISO 8601, or null while no definition has been submitted. */
        definitionUpdatedAt: z.string().nullable(),
      },
    },
    () =>
      runTool(deps.logger, async () => {
        const project = await deps.projects.requireAccess(agent, projectId);
        const hasConnection = await deps.connections.hasConnection(agent, projectId);
        const stored = await deps.definitions.getValidationResult(agent, projectId);
        const connectionSetupUrl = hasConnection ? null : `${deps.consoleUrl}/p/${projectId}`;

        const payload = {
          name: project.name,
          key: project.key,
          hasConnection,
          connectionSetupUrl,
          definitionStatus: statusOf(stored),
          definitionUpdatedAt: stored?.updatedAt ?? null,
        };

        if (!connectionSetupUrl) return toolResult(payload);
        // The instruction leads; the payload still follows in full, because the
        // agent needs the definition status whether or not it has to go and wait.
        return toolResult(
          payload,
          `${directHumanToConsole(connectionSetupUrl)}\n\n${JSON.stringify(payload, null, 2)}`,
        );
      }),
  );

  server.registerTool(
    "get_schema_documentation",
    {
      title: "Get schema documentation",
      description: `Return the complete RePanel definition schema documentation as
markdown: every key, every field type, the validation rules, the containment rules for
sensitive and hidden fields, and a worked example. Read this before writing or repairing a
definition — it is the authoritative contract and it is short. Do not guess at keys:
unknown keys are rejected everywhere.`,
      inputSchema: NO_ARGUMENTS,
      // No output schema: the answer is the document, and declaring one would
      // oblige us to send those ten kilobytes twice in a single result.
    },
    () => runTool(deps.logger, async () => toolText(await deps.schemaDocumentation.read())),
  );

  server.registerTool(
    "get_definition",
    {
      title: "Get definition",
      description: `Return this project's current definition draft exactly as it was last
submitted, valid or not, along with when it was submitted and whether it validated. Read it
before editing, so you change the definition that is actually stored rather than one you
assume. If it reports \`invalid\`, call get_validation_result for the full problem list.`,
      inputSchema: NO_ARGUMENTS,
      outputSchema: {
        status: definitionStatusSchema,
        /** The payload as submitted; null when nothing has been submitted yet. */
        definition: z.unknown(),
        updatedAt: z.string().nullable(),
      },
    },
    () =>
      runTool(deps.logger, async () => {
        const draft = await deps.definitions.getDraft(agent, projectId);
        if (!draft) {
          return toolResult(
            { status: "none", definition: null, updatedAt: null },
            "No definition has been submitted for this project yet. " +
              "Read get_schema_documentation, then call submit_definition.",
          );
        }

        return toolResult({
          status: statusOf(draft),
          definition: draft.payload,
          updatedAt: draft.updatedAt,
        });
      }),
  );

  server.registerTool(
    "submit_definition",
    {
      title: "Submit definition",
      description: `Submit the complete definition for this project. This replaces the whole
draft — there are no partial updates, so send the entire object every time. The response says
whether it validated; if it did not, it carries every problem found, each with the exact path,
what was expected, and a concrete fix. Invalid submissions are stored, so nothing is lost:
repair the definition and submit again until \`valid\` is true. A good workflow is: inspect the
customer's application and database, then get_schema_documentation, then get_definition if one
already exists, then submit_definition, repairing until valid.`,
      inputSchema: {
        definition: z
          .looseObject({})
          .describe(
            "The complete RePanel definition object, matching the schema " +
              "from get_schema_documentation.",
          ),
      },
      outputSchema: {
        valid: z.boolean(),
        errorCount: z.number().int().nonnegative(),
        /** Every problem found, never truncated; empty when valid. */
        errors: z.array(validationErrorSchema),
      },
    },
    ({ definition }) =>
      runTool(deps.logger, async () => {
        const result = await deps.definitions.submitDraft(agent, projectId, definition);
        if (result.valid) {
          return toolResult(
            { valid: true, ...reported([]) },
            "The definition is valid and is now this project's draft.",
          );
        }

        return toolResult(
          { valid: false, ...reported(result.errors) },
          renderValidationReport(result.errors),
        );
      }),
  );

  server.registerTool(
    "get_validation_result",
    {
      title: "Get validation result",
      description: `Return the outcome of the last submission without validating anything again: the
status and, when invalid, the full problem list. Use it to resume a repair loop — later in a
session, or in a new one — without resubmitting a definition you have not changed.`,
      inputSchema: NO_ARGUMENTS,
      outputSchema: {
        status: definitionStatusSchema,
        errorCount: z.number().int().nonnegative(),
        errors: z.array(validationErrorSchema),
        updatedAt: z.string().nullable(),
      },
    },
    () =>
      runTool(deps.logger, async () => {
        const stored = await deps.definitions.getValidationResult(agent, projectId);
        const payload = {
          status: statusOf(stored),
          ...reported(stored?.errors ?? []),
          updatedAt: stored?.updatedAt ?? null,
        };

        return stored?.valid === false
          ? toolResult(payload, renderValidationReport(stored.errors ?? []))
          : toolResult(payload);
      }),
  );
}

/**
 * The one step of setup an agent must not perform for the human. A connection
 * string is a credential and a transcript is not a vault, so the tool's whole
 * job here is to name the place the human pastes it.
 */
function directHumanToConsole(url: string): string {
  return (
    "This project has no customer database connection yet. Do not ask for a connection " +
    `string — send the human to ${url}, the Connection section, and carry on once they ` +
    "confirm it is saved. You can write and validate the whole definition before then."
  );
}

/** How a draft stands, including never having been submitted at all. */
function statusOf(stored: Pick<StoredValidation, "valid"> | null): "none" | "invalid" | "valid" {
  if (!stored) return "none";
  return stored.valid ? "valid" : "invalid";
}

/** The count is derived from the list it counts, so the two cannot disagree. */
function reported(errors: readonly ValidationError[]): {
  errorCount: number;
  errors: ValidationError[];
} {
  return { errorCount: errors.length, errors: [...errors] };
}
