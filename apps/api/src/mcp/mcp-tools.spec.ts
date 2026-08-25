import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { validateDefinition, type ProjectDto, type ValidationError } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { AgentPrincipal, Principal } from "../auth/principal";
import { ConfigService } from "../config/config.service";
import { ConnectionsService } from "../connections/connections.service";
import { MAX_PAYLOAD_BYTES } from "../definitions/definition-size";
import {
  DefinitionVersionsRepository,
  type DefinitionVersionRow,
} from "../definitions/definition-versions.repository";
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

const CREWBASE = "project-crewbase";

/** The agent holding Crewbase's token, and one holding some other project's. */
const AGENT: AgentPrincipal = { kind: "agent", projectId: CREWBASE };
const STRANGER: AgentPrincipal = { kind: "agent", projectId: "project-ledger" };

const PROJECT: ProjectDto = {
  id: CREWBASE,
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

/** A definition missing everything below `app`, so validation has plenty to say. */
const BROKEN = { schemaVersion: "0.1", app: { name: "Acme Admin" } };

/** Structurally sound, but forty navigation entries point at nothing. */
const FORTY_PROBLEMS = {
  ...saasDefinition,
  navigation: [
    // The fixture's own groups stay, so the resources remain reachable and the
    // forty problems are forty of one kind.
    ...saasDefinition.navigation,
    ...Array.from({ length: 40 }, (_unused, index) => ({
      label: `Group ${index}`,
      resources: [`missing_${index}`],
    })),
  ],
};

const DOCUMENTATION = "# RePanel definition schema — v0\n\nEvery key, written out.";

/** Where this deployment serves the console, as CONSOLE_URL would say. */
const CONSOLE_URL = "https://console.repanel.test";

/** Where it serves the rendered admin, as RUNTIME_URL would say. */
const RUNTIME_URL = "https://admin.repanel.test";

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

/** Stands in for the versions table: append-only, newest number wins. */
class InMemoryDefinitionVersionsRepository
  implements Pick<DefinitionVersionsRepository, "insertNext" | "findLatest">
{
  readonly rows: DefinitionVersionRow[] = [];

  insertNext(projectId: string, payload: unknown): Promise<DefinitionVersionRow> {
    const published: DefinitionVersionRow = {
      id: `version-${this.rows.length + 1}`,
      projectId,
      version: this.rows.filter((row) => row.projectId === projectId).length + 1,
      payload: JSON.parse(JSON.stringify(payload)) as unknown,
      publishedAt: new Date("2026-08-19T11:00:00.000Z"),
    };

    this.rows.push(published);
    return Promise.resolve(published);
  }

  findLatest(projectId: string): Promise<DefinitionVersionRow | undefined> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.projectId === projectId)
        .sort((a, b) => b.version - a.version)[0],
    );
  }
}

/** Stands in for the projects feature: Crewbase's token reaches Crewbase. */
class ReachableProjects implements Pick<ProjectsService, "requireAccess"> {
  requireAccess(principal: Principal, projectId: string): Promise<ProjectDto> {
    if (principal.kind !== "agent" || principal.projectId !== projectId || projectId !== CREWBASE) {
      return Promise.reject(new NotFoundError("Project not found"));
    }
    return Promise.resolve(PROJECT);
  }
}

/** Stands in for the connections feature: the projects that have been pointed
 *  at a database, refusing anything Crewbase's token cannot reach. */
class ConnectedProjects implements Pick<ConnectionsService, "hasConnection"> {
  private readonly connected = new Set<string>();

  /** Points a project at a customer database, as setting one would. */
  add(projectId: string): void {
    this.connected.add(projectId);
  }

  hasConnection(principal: Principal, projectId: string): Promise<boolean> {
    if (principal.kind !== "agent" || principal.projectId !== projectId || projectId !== CREWBASE) {
      return Promise.reject(new NotFoundError("Project not found"));
    }
    return Promise.resolve(this.connected.has(projectId));
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
  let versions: InMemoryDefinitionVersionsRepository;
  /** The store a test writes to, and the same object as the tools receive it. */
  let connected: ConnectedProjects;
  let definitions: DefinitionsService;
  let connections: ConnectionsService;
  let projects: ProjectsService;
  let schemaDocumentation: SchemaDocumentationService;
  let clients: Client[];

  beforeEach(async () => {
    logged.length = 0;
    clients = [];
    repository = new InMemoryDefinitionsRepository();
    versions = new InMemoryDefinitionVersionsRepository();
    connected = new ConnectedProjects();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DefinitionsService,
        { provide: DefinitionsRepository, useValue: repository },
        { provide: DefinitionVersionsRepository, useValue: versions },
        { provide: ConnectionsService, useValue: connected },
        { provide: ProjectsService, useValue: new ReachableProjects() },
        { provide: ConfigService, useValue: { runtimeUrl: RUNTIME_URL } },
        {
          provide: SchemaDocumentationService,
          useValue: { read: () => Promise.resolve(DOCUMENTATION) },
        },
      ],
    }).compile();

    definitions = moduleRef.get(DefinitionsService);
    connections = moduleRef.get(ConnectionsService);
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
      connections,
      definitions,
      schemaDocumentation,
      consoleUrl: CONSOLE_URL,
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
        publish: expect.objectContaining({ type: "boolean", default: true }),
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
        name: "Crewbase",
        key: "crewbase-a3k9x2",
        hasConnection: false,
        connectionSetupUrl: `${CONSOLE_URL}/p/${CREWBASE}`,
        definitionStatus: "none",
        definitionUpdatedAt: null,
      });
    });

    it("sends the human, not the agent, to configure a missing connection", async () => {
      const client = await connect();

      const result = await call(client, "get_project");

      const text = textOf(result);
      expect(text).toContain(`${CONSOLE_URL}/p/${CREWBASE}`);
      expect(text).toContain("Do not ask for a connection string");
      // The payload still travels in full: the agent has work it can do meanwhile.
      expect(text).toContain('"definitionStatus": "none"');
    });

    it("reports the customer database once the project has been pointed at one", async () => {
      connected.add(CREWBASE);
      const client = await connect();

      const result = await call(client, "get_project");

      expect(payloadOf(result)).toMatchObject({ hasConnection: true });
    });

    it("drops the setup link, and the instruction, once a connection exists", async () => {
      connected.add(CREWBASE);
      const client = await connect();

      const result = await call(client, "get_project");

      expect(payloadOf(result)).toMatchObject({ connectionSetupUrl: null });
      expect(textOf(result)).not.toContain(CONSOLE_URL);
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
    /**
     * The call a client written before publishing existed makes: one argument,
     * no `publish`. What it did then is what it has to do now — the definition
     * it submits is the one the admin serves — or the change was not additive,
     * whatever the schema says.
     */
    it("takes the call a client written before publishing existed makes", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", { definition: saasDefinition });

      expect(payloadOf(result)).toMatchObject({ valid: true, errorCount: 0, errors: [] });
      expect(versions.rows).toHaveLength(1);
      expect(versions.rows[0]).toMatchObject({ version: 1, payload: saasDefinition });
    });

    it("accepts a definition that validates, and says it is live", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", { definition: saasDefinition });

      expect(payloadOf(result)).toEqual({
        valid: true,
        outcome: "published",
        version: 1,
        errorCount: 0,
        errors: [],
      });
      expect(textOf(result)).toContain("now live as version 1");
    });

    it("holds a definition the agent asked not to publish, and says the admin is unchanged", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", {
        definition: saasDefinition,
        publish: false,
      });

      expect(payloadOf(result)).toEqual({
        valid: true,
        outcome: "held",
        version: null,
        errorCount: 0,
        errors: [],
      });
      expect(textOf(result)).toContain("Nothing was published");
      expect(versions.rows).toEqual([]);
      // Held, not lost: the draft is there to be published or repaired.
      expect(payloadOf(await call(client, "get_definition"))).toMatchObject({ status: "valid" });
    });

    /**
     * The transcript the whole feature comes from, at the surface an agent
     * touches: a repair loop over a live admin does not take it down.
     */
    it("publishes nothing when a definition does not validate, whatever was asked", async () => {
      const client = await connect();
      await call(client, "submit_definition", { definition: saasDefinition });

      const result = await call(client, "submit_definition", {
        definition: BROKEN,
        publish: true,
      });

      const payload = payloadOf(result);
      expect(payload).toMatchObject({ valid: false, outcome: "invalid", version: null });
      expect(payload.errors).toEqual(errorsFor(BROKEN));
      // Still one version, still the definition that validated.
      expect(versions.rows).toHaveLength(1);
      expect(versions.rows[0]).toMatchObject({ version: 1, payload: saasDefinition });
      expect(textOf(result)).toContain("what operators see has not changed");
    });

    it("names which of the three things happened, every time", async () => {
      const client = await connect();

      const published = payloadOf(
        await call(client, "submit_definition", { definition: saasDefinition }),
      );
      const held = payloadOf(
        await call(client, "submit_definition", { definition: saasDefinition, publish: false }),
      );
      const invalid = payloadOf(await call(client, "submit_definition", { definition: BROKEN }));

      expect([published.outcome, held.outcome, invalid.outcome]).toEqual([
        "published",
        "held",
        "invalid",
      ]);
    });

    it("answers an invalid definition with every problem validation found", async () => {
      const client = await connect();

      const result = await call(client, "submit_definition", { definition: BROKEN });

      const expected = errorsFor(BROKEN);
      expect(payloadOf(result)).toEqual({
        valid: false,
        outcome: "invalid",
        version: null,
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
      expect(versions.rows).toEqual([]);
    });

    it("answers an agent submitting to a project its token does not name as missing", async () => {
      const client = await connect(STRANGER);

      const result = await call(client, "submit_definition", { definition: saasDefinition });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toBe("Project not found");
      expect(repository.rows).toEqual([]);
      expect(versions.rows).toEqual([]);
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
