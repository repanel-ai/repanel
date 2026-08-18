import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DbModule } from "../db/db.module";
import { ProjectsModule } from "../projects/projects.module";
import { AgentTokenGuard } from "./agent-token.guard";
import { AgentTokensController } from "./agent-tokens.controller";
import { AgentTokensRepository } from "./agent-tokens.repository";
import { AgentTokensService } from "./agent-tokens.service";

/** The guard is exported for the MCP server, which is the only thing tokens open. */
@Module({
  imports: [AuthModule, DbModule, ProjectsModule],
  controllers: [AgentTokensController],
  providers: [AgentTokensService, AgentTokensRepository, AgentTokenGuard],
  exports: [AgentTokensService, AgentTokenGuard],
})
export class AgentTokensModule {}
