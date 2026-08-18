import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { AgentTokensModule } from "./agent-tokens/agent-tokens.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { DefinitionsModule } from "./definitions/definitions.module";
import { DomainExceptionFilter } from "./errors/domain-exception.filter";
import { HealthModule } from "./health/health.module";
import { ProjectsModule } from "./projects/projects.module";

@Module({
  imports: [
    AgentTokensModule,
    AuthModule,
    ConfigModule,
    DbModule,
    DefinitionsModule,
    HealthModule,
    ProjectsModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
export class AppModule {}
