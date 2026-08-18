import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Injectable, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import type { AgentPrincipal } from "../auth/principal";
import { DefinitionsService } from "../definitions/definitions.service";
import { ProjectsService } from "../projects/projects.service";
import { createMcpServer } from "./mcp-server";
import { SchemaDocumentationService } from "./schema-documentation.service";

/**
 * One MCP request, start to finish. The request is the session: a token already
 * scopes the connection to one project, so there is no state worth keeping
 * between calls, nothing to expire, and nothing to evict when a client vanishes.
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly projects: ProjectsService,
    private readonly definitions: DefinitionsService,
    private readonly schemaDocumentation: SchemaDocumentationService,
  ) {}

  async handle(agent: AgentPrincipal, request: Request, response: Response): Promise<void> {
    const server = createMcpServer(agent, {
      projects: this.projects,
      definitions: this.definitions,
      schemaDocumentation: this.schemaDocumentation,
      logger: this.logger,
    });
    const transport = new StreamableHTTPServerTransport({
      // Stateless: no session id to issue, resume, or expire.
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    response.on("close", () => {
      void transport.close();
      void server.close();
    });

    await server.connect(transport);
    // The body is already parsed by the time it reaches us, so hand it over
    // rather than letting the transport read a stream that is spent.
    await transport.handleRequest(request, response, request.body);
  }
}
