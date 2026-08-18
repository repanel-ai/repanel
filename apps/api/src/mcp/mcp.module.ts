import { Module } from "@nestjs/common";
import { AgentTokensModule } from "../agent-tokens/agent-tokens.module";
import { DefinitionsModule } from "../definitions/definitions.module";
import { ProjectsModule } from "../projects/projects.module";
import { McpController } from "./mcp.controller";
import { McpService } from "./mcp.service";
import { SchemaDocumentationService } from "./schema-documentation.service";

/** The authoring interface: the MCP server a customer's coding agent connects to. */
@Module({
  imports: [AgentTokensModule, DefinitionsModule, ProjectsModule],
  controllers: [McpController],
  providers: [McpService, SchemaDocumentationService],
})
export class McpModule {}
