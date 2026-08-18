import { Module } from "@nestjs/common";
import { DbModule } from "../db/db.module";
import { ProjectsModule } from "../projects/projects.module";
import { DefinitionsRepository } from "./definitions.repository";
import { DefinitionsService } from "./definitions.service";

/** No transport of its own yet: the MCP server is what will call this. */
@Module({
  imports: [DbModule, ProjectsModule],
  providers: [DefinitionsService, DefinitionsRepository],
  exports: [DefinitionsService],
})
export class DefinitionsModule {}
