import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { validateDefinition, type ProjectDto, type ValidationError } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { AgentPrincipal, Principal } from "../auth/principal";
import { MAX_PAYLOAD_BYTES } from "../definitions/definition-size";
import {
  DefinitionsRepository,
  type DefinitionRow,
  type NewDefinitionRow,
} from "../definitions/definitions.repository";
import { DefinitionsService } from "../definitions/definitions.service";
import { NotFoundError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { createMcpServer } from "./mcp-server";
import { SchemaDocumentationService } from "./schema-documentation.service";

const SKYSCOUT = "project-skyscout";

/** The agent holding SkyScout's token, and one holding some other project's. */
const AGENT: AgentPrincipal = { kind: "agent", projectId: SKYSCOUT };
const STRANGER: AgentPrincipal = { kind: "agent", projectId: "project-ledger" };

const PROJECT: ProjectDto = {
  id: SKYSCOUT,
  name: "SkyScout",
  key: "skyscout-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

/** A definition missing everything below `app`, so validation has plenty to say. */
const BROKEN = { schemaVersion: "0.1", app: { name: "Acme Admin" } };

/** Structurally sound, but every navigation entry points at nothing. */
const FORTY_PROBLEMS = {
  ...saasDefinition,
  navigation: Array.from({ length: 40 }, (_unused, index) => ({
    label: `Group ${index}`,
    resources: [`missing_${index}`],
  })),
};

const DOCUMENTATION = "# RePanel definition schema — v0\n\nEvery key, written out.";

const TOOL_NAMES = [
  "get_definition",
  "get_project",
  "get_schema_documentation",
  "get_validation_result",
  "submit_definition",
];

/** Stands in for Postgres: one draft per project, and json in, json out. */
class InMemoryDefinitionsRepository
  implements Pick<DefinitionsRepository, "save" | "findByProjectId">
{
  readonly rows: DefinitionRow[] = [];
  /** How many times a draft has been written, so a read can prove it read. */
  saves = 0;

  save(draft: NewDefinitionRow): Promise<DefinitionRow> {
    this.saves += 1;
    const previous = this.rows.find((row) => row.projectId === draft.projectId);
    const saved: DefinitionRow = {
      id: previous?.id ?? `definition-${this.rows.length + 1}`,
      projectId: draft.projectId,
      payload: JSON.parse(JSON.stringify(draft.payload)) as unknown,
      valid: draft.valid,
      errors: draft.errors ?? null,
      createdAt: previous?.createdAt ?? new Date("2026-08-19T10:00:00.000Z"),
      updatedAt: new Date("2026-08-19T11:00:00.000Z"),
    };

    if (previous) this.rows.splice(this.rows.indexOf(previous), 1, saved);
    else this.rows.push(saved);
    return Promise.resolve(saved);
  }

  findByProjectId(projectId: string): Promise<DefinitionRow | undefined> {
    return Promise.resolve(this.rows.find((row) => row.projectId === projectId));
  }
}

/** Stands in for the projects feature: SkyScout's token reaches SkyScout. */
class ReachableProjects implements Pick<ProjectsService, "requireAccess"> {
  requireAccess(principal: Principal, projectId: string): Promise<ProjectDto> {
    if (principal.kind !== "agent" || principal.projectId !== projectId || projectId !== SKYSCOUT) {
      return Promise.reject(new NotFoundError("Project not found"));
    }
    return Promise.resolve(PROJECT);
  }
}

/** The errors validation reported for a payload; fails the test if it liked it. */
function errorsFor(payload: unknown): ValidationError[] {
  const result = validateDefinition(payload);
  if (result.valid) throw new Error("expected the definition to be invalid");
  return result.errors;
}

describe("MCP tools", () => {
  const logged: string[] = [];
  const logger = { error: (message: string) => logged.push(message) } as unknown as Logger;

  let repository: InMemoryDefinitionsRepository;
  let definitions: DefinitionsService;
  let projects: ProjectsService;
  let schemaDocumentation: SchemaDocumentationService;
  let clients: Client[];

  beforeEach(async () => {
    logged.length = 0;
    clients = [];
    repository = new InMemoryDefinitionsRepository();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DefinitionsService,
        { provide: DefinitionsRepository, useValue: repository },
        { provide: ProjectsService, useValue: new ReachableProjects() },
        {
          provide: SchemaDocumentationService,
          useValue: { read: () => Promise.resolve(DOCUMENTATION) },
        },
      ],
    }).compile();

    definitions = moduleRef.get(DefinitionsService);
    projects = moduleRef.get(ProjectsService);
    schemaDocumentation = moduleRef.get(SchemaDocumentationService);
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
  });

  /** A real MCP client, talking to the real server over an in-process pair. */
  async function connect(agent: AgentPrincipal = AGENT): Promise<Client> {
    const server = createMcpServer(agent, {
      projects,
      definitions,
      schemaDocumentation,
      logger,
    });
    const [clientEnd, serverEnd] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "spec", version: "0.0.0" });

    await Promise.all([client.connect(clientEnd), server.connect(serverEnd)]);
    clients.push(client);
    return client;
  }

  async function call(
    client: Client,
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<CallToolResult> {
    return (await client.callTool({ name, arguments: args })) as CallToolResult;
  }

  /** What a result says in words. */
  function textOf(result: CallToolResult): string {
    return result.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
  }

  /** What a result says in structure. */
  function payloadOf(result: CallToolResult): Record<string, unknown> {
    expect(result.isError).toBeFalsy();
    return result.structuredContent as Record<string, unknown>;
  }

  describe("the session", () => {
    it("publishes the tools an authoring agent works through, and no others", async () => {
      const client = await connect();

      const { tools } = await client.listTools();

      expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
    });

    it("tells every tool what it is for", async () => {
      const client = await connect();

      const { tools } = await client.listTools();

      for (const tool of tools) {
        expect(tool.description?.length ?? 0).toBeGreaterThan(80);
        expect(tool.inputSchema.type).toBe("object");
      }
    });

    it("asks for the definition as an object, and constrains it no further", async () => {
      const client = await connect();

      const { tools } = await client.listTools();
      const submit = tools.find((tool) => tool.name === "submit_definition");

      // Validation is the definition's own answer to give, not the transport's.
      expect(submit?.inputSchema.required).toEqual(["definition"]);
      expect(submit?.inputSchema.properties).toEqual({
        definition: expect.objectContaining({ type: "object" }),
      });
    });

    it("says how the tools fit together before any of them is called", async () => {
      const client = await connect();

      const instructions = client.getInstructions() ?? "";

      expect(instructions).toContain("get_schema_documentation");
      expect(instructions).toContain("submit_definition");
      expect(instructions).toContain("until the definition is valid");
    });
  });

  describe("get_project", () => {
    it("describes the project the token names", async () => {
      const client = await connect();

      const result = await call(client, "get_project");

      expect(payloadOf(result)).toEqual({
        name: "SkyScout",
        key: "skyscout-a3k9x2",
        hasConnection: false,
        definitionStatus: "none",
        definitionUpdatedAt: null,
      });
    });

    it("reports how the definition stands once one has been submitted", async () => {
      const client = await connect();
      await call(client, "submit_definition", { definition: saasDefinition });

      const result = await call(client, "get_project");

      expect(payloadOf(result)).toMatchObject({
        definitionStatus: "valid",
        definitionUpdatedAt: "2026-08-19T11:00:00.000Z",
      });
    });

    it("answers an agent whose token names another project as missing", async () => {
      const client = await connect(STRANGER);

      const result = await call(client, "get_project");

      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe("Project not found");
    });
  });

  describe("get_schema_documentation", () => {
    it("hands over the document itself", async () => {
      const client = await connect();

      const result = await call(client, "get_schema_documentation");

      expect(textOf(result)).toBe(DOCUMENTATION);
      // The document is the answer; sending it twice would only cost tokens.
      expect(result.structuredContent).toBeUndefined();
    });
  });

  describe("get_definition", () => {
    it("says plainly when there is nothing to read yet", async () => {
      const client = await connect();

      const result = await call(client, "get_definition");

      expect(payloadOf(result)).toEqual({ status: "none", definition: null, updatedAt: null });
      expect(textOf(result)).toContain("No definition has been submitted");
    });

    it("hands back the definition exactly as it was submitted", async () => {
      const client = await connect();
      await call(client, "submit_definition", { definition: saasDefinition });

      const result = await call(client, "get_definition");

      expect(payloadOf(result)).toEqual({
        status: "valid",
        definition: saasDefinition,
        updatedAt: "2026-08-19T11:00:00.000Z",
      });
    });

    it("hands back an invalid draft too, so the agent can see what it sent", async () => {
      const client = await connect();
      await call(client, "submit_definition", { definition: BROKEN });

      const result = await call(client, "get_definition");

      expect(payloadOf(result)).toMatchObject({ status: "invalid", definition: BROKEN });
    });
  });

  describe("submit_definition", () => {
    it("accepts a definition that validates", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", { definition: saasDefinition });

      expect(payloadOf(result)).toEqual({ valid: true, errorCount: 0, errors: [] });
      expect(textOf(result)).toContain("valid");
    });

    it("answers an invalid definition with every problem validation found", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", { definition: BROKEN });

      const expected = errorsFor(BROKEN);
      expect(payloadOf(result)).toEqual({
        valid: false,
        errorCount: expected.length,
        errors: expected,
      });
    });

    it("carries the location, the expectation and the fix for each problem", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", { definition: BROKEN });
      const errors = payloadOf(result).errors as ValidationError[];

      for (const error of errors) {
        expect(Object.keys(error).sort()).toEqual(["expected", "hint", "message", "path"]);
        expect(textOf(result)).toContain(error.path);
        expect(textOf(result)).toContain(error.message);
        expect(textOf(result)).toContain(error.hint);
      }
    });

    it("truncates nothing, however many problems there are", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", { definition: FORTY_PROBLEMS });
      const payload = payloadOf(result);

      expect(payload.errorCount).toBe(40);
      expect(payload.errors).toEqual(errorsFor(FORTY_PROBLEMS));
      for (const error of payload.errors as ValidationError[]) {
        expect(textOf(result)).toContain(error.path);
      }
    });

    it("counts exactly the problems it reports", async () => {
      const client = await connect();

      for (const definition of [saasDefinition, BROKEN, FORTY_PROBLEMS]) {
        const payload = payloadOf(await call(client, "submit_definition", { definition }));

        expect(payload.errorCount).toBe((payload.errors as ValidationError[]).length);
      }
    });

    it("replaces the draft rather than adding to it", async () => {
      const client = await connect();

      await call(client, "submit_definition", { definition: BROKEN });
      await call(client, "submit_definition", { definition: saasDefinition });

      expect(repository.rows).toHaveLength(1);
      expect(payloadOf(await call(client, "get_definition"))).toMatchObject({ status: "valid" });
    });

    it("refuses a payload too large to be a definition, in words the agent can use", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", {
        definition: { note: "x".repeat(MAX_PAYLOAD_BYTES) },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain("too large");
      expect(textOf(result)).toContain(`${MAX_PAYLOAD_BYTES} byte limit`);
      expect(repository.rows).toEqual([]);
    });

    it("answers an agent submitting to a project its token does not name as missing", async () => {
      const client = await connect(STRANGER);

      const result = await call(client, "submit_definition", { definition: saasDefinition });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe("Project not found");
      expect(repository.rows).toEqual([]);
    });
  });

  describe("get_validation_result", () => {
    it("says there is nothing to report before anything is submitted", async () => {
      const client = await connect();

      const result = await call(client, "get_validation_result");

      expect(payloadOf(result)).toEqual({
        status: "none",
        errorCount: 0,
        errors: [],
        updatedAt: null,
      });
    });

    it("repeats the last verdict without validating anything again", async () => {
      const client = await connect();
      await call(client, "submit_definition", { definition: BROKEN });
      const writes = repository.saves;

      const result = await call(client, "get_validation_result");

      expect(payloadOf(result)).toEqual({
        status: "invalid",
        errorCount: errorsFor(BROKEN).length,
        errors: errorsFor(BROKEN),
        updatedAt: "2026-08-19T11:00:00.000Z",
      });
      expect(repository.saves).toBe(writes);
    });

    it("writes the problems out for the agent that has to fix them", async () => {
      const client = await connect();
      await call(client, "submit_definition", { definition: BROKEN });

      const result = await call(client, "get_validation_result");

      expect(textOf(result)).toContain("call submit_definition again");
      for (const error of errorsFor(BROKEN)) expect(textOf(result)).toContain(error.hint);
    });

    it("reports a valid draft as having nothing to fix", async () => {
      const client = await connect();
      await call(client, "submit_definition", { definition: saasDefinition });

      const result = await call(client, "get_validation_result");

      expect(payloadOf(result)).toMatchObject({ status: "valid", errorCount: 0, errors: [] });
    });
  });

  it("keeps its internals to itself throughout", async () => {
    const client = await connect();
    await call(client, "submit_definition", { definition: BROKEN });

    // Nothing unexpected happened, so nothing was swallowed and logged either.
    expect(logged).toEqual([]);
  });
});
