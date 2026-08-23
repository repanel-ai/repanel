import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DbModule } from "../db/db.module";
import { ProjectsModule } from "../projects/projects.module";
import { DefinitionsController } from "./definitions.controller";
import { DefinitionsRepository } from "./definitions.repository";
import { DefinitionsService } from "./definitions.service";

/**
 * Definitions are written through MCP and read back there. The one route here
 * is the console's: how the last submission fared, for the human watching.
 */
@Module({
  imports: [AuthModule, DbModule, ProjectsModule],
  controllers: [DefinitionsController],
  providers: [DefinitionsService, DefinitionsRepository],
  exports: [DefinitionsService],
})
export class DefinitionsModule {}
