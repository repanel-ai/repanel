import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConnectionsModule } from "../connections/connections.module";
import { DefinitionsModule } from "../definitions/definitions.module";
import { ProjectsModule } from "../projects/projects.module";
import { QueryBuilderService } from "./query/query-builder.service";
import { RuntimeController } from "./runtime.controller";
import { RuntimeService } from "./runtime.service";

/**
 * The rendered admin's read side: the definition, and the records it describes.
 *
 * Both providers are exported for the actions feature, which writes. It reaches
 * the same resolved definition through `RuntimeService` rather than resolving
 * one of its own, and the same `QueryBuilderService` rather than assembling SQL
 * of its own — there is one door into a customer's database and it is this
 * module's (DECISIONS #024).
 */
@Module({
  imports: [AuthModule, ConnectionsModule, DefinitionsModule, ProjectsModule],
  controllers: [RuntimeController],
  providers: [RuntimeService, QueryBuilderService],
  exports: [RuntimeService, QueryBuilderService],
})
export class RuntimeModule {}
