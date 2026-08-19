import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConnectionsModule } from "../connections/connections.module";
import { DefinitionsModule } from "../definitions/definitions.module";
import { ProjectsModule } from "../projects/projects.module";
import { QueryBuilderService } from "./query/query-builder.service";
import { RuntimeController } from "./runtime.controller";
import { RuntimeService } from "./runtime.service";

/** The rendered admin's read side: the definition, and the records it describes. */
@Module({
  imports: [AuthModule, ConnectionsModule, DefinitionsModule, ProjectsModule],
  controllers: [RuntimeController],
  providers: [RuntimeService, QueryBuilderService],
})
export class RuntimeModule {}
