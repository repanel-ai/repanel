import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "../config/config.module";
import { ConnectorSocketsModule } from "../connector-sockets/connector-sockets.module";
import { DbModule } from "../db/db.module";
import { ProjectsModule } from "../projects/projects.module";
import { DefinitionVersionsRepository } from "./definition-versions.repository";
import { DefinitionsController } from "./definitions.controller";
import { DefinitionsRepository } from "./definitions.repository";
import { DefinitionsService } from "./definitions.service";

/**
 * Definitions are written through MCP and read back there. The routes here
 * belong to the humans: how the definition stands, for the console, a
 * submission of their own, for `repanel deploy`, and the decision to make a
 * draft the version their operators see.
 */
@Module({
  imports: [AuthModule, ConfigModule, ConnectorSocketsModule, DbModule, ProjectsModule],
  controllers: [DefinitionsController],
  providers: [DefinitionsService, DefinitionsRepository, DefinitionVersionsRepository],
  exports: [DefinitionsService],
})
export class DefinitionsModule {}
