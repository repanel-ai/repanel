import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AgentTokensModule } from "./agent-tokens/agent-tokens.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { ConnectionsModule } from "./connections/connections.module";
import { DbModule } from "./db/db.module";
import { DefinitionsModule } from "./definitions/definitions.module";
import { DomainExceptionFilter } from "./errors/domain-exception.filter";
import { HealthModule } from "./health/health.module";
import { McpModule } from "./mcp/mcp.module";
import { ProjectsModule } from "./projects/projects.module";
import { RuntimeModule } from "./runtime/runtime.module";

@Module({
  imports: [
    AgentTokensModule,
    AuthModule,
    ConfigModule,
    ConnectionsModule,
    DbModule,
    DefinitionsModule,
    HealthModule,
    McpModule,
    ProjectsModule,
    RuntimeModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
