import { Module } from "@nestjs/common";
import { QueryBuilder, RecordReader } from "@repanel/engine";
import { AuthModule } from "../auth/auth.module";
import { ConnectionsModule } from "../connections/connections.module";
import { DefinitionsModule } from "../definitions/definitions.module";
import { ProjectsModule } from "../projects/projects.module";
import { RuntimeController } from "./runtime.controller";
import { RuntimeService } from "./runtime.service";

/**
 * The rendered admin's read side: the definition, and the records it describes.
 *
 * The engine's own classes carry no decorators, so they are provided by factory
 * — that is where dependency injection stops and the package begins. All three
 * providers are exported for the actions feature, which writes: it reaches the
 * same resolved definition through `RuntimeService` and the same builder and
 * reader rather than assembling SQL of its own, because there is one door into
 * a customer's database and it is this module's (DECISIONS #024).
 */
@Module({
  imports: [AuthModule, ConnectionsModule, DefinitionsModule, ProjectsModule],
  controllers: [RuntimeController],
  providers: [
    RuntimeService,
    { provide: QueryBuilder, useFactory: () => new QueryBuilder() },
    {
      provide: RecordReader,
      useFactory: (queries: QueryBuilder) => new RecordReader(queries),
      inject: [QueryBuilder],
    },
  ],
  exports: [RuntimeService, QueryBuilder, RecordReader],
})
export class RuntimeModule {}
