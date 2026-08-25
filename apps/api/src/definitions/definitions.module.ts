import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "../config/config.module";
import { DbModule } from "../db/db.module";
import { ProjectsModule } from "../projects/projects.module";
import { DefinitionsController } from "./definitions.controller";
import { DefinitionsRepository } from "./definitions.repository";
import { DefinitionsService } from "./definitions.service";

/**
 * Definitions are written through MCP and read back there. The two routes here
 * belong to the humans: how the last submission fared, for the console, and a
 * submission of their own, for `repanel deploy`.
 */
@Module({
  imports: [AuthModule, ConfigModule, DbModule, ProjectsModule],
  controllers: [DefinitionsController],
  providers: [DefinitionsService, DefinitionsRepository],
  exports: [DefinitionsService],
})
export class DefinitionsModule {}
