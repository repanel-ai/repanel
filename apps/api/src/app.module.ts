import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ActionsModule } from "./actions/actions.module";
import { ActivityModule } from "./activity/activity.module";
import { AgentTokensModule } from "./agent-tokens/agent-tokens.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { ConnectionsModule } from "./connections/connections.module";
import { ConnectorModule } from "./connector/connector.module";
import { DbModule } from "./db/db.module";
import { DefinitionsModule } from "./definitions/definitions.module";
import { DomainExceptionFilter } from "./errors/domain-exception.filter";
import { HealthModule } from "./health/health.module";
import { McpModule } from "./mcp/mcp.module";
import { ProjectsModule } from "./projects/projects.module";
import { RecordsModule } from "./records/records.module";
import { RuntimeModule } from "./runtime/runtime.module";

@Module({
  imports: [
    ActionsModule,
    ActivityModule,
    AgentTokensModule,
    AuthModule,
    ConfigModule,
    ConnectionsModule,
    ConnectorModule,
    DbModule,
    DefinitionsModule,
    HealthModule,
    McpModule,
    ProjectsModule,
    RecordsModule,
    RuntimeModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
