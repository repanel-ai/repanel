import { Module } from "@nestjs/common";
import { ActionRunner, HttpCall, QueryBuilder, RecordReader, RecordWriter } from "@repanel/engine";
import { AuthModule } from "../auth/auth.module";
import { ConnectionsModule } from "../connections/connections.module";
import { ConnectorSocketsModule } from "../connector-sockets/connector-sockets.module";
import { DefinitionsModule } from "../definitions/definitions.module";
import { ProjectsModule } from "../projects/projects.module";
import { ExecutorsService } from "./executors.service";
import { RuntimeController } from "./runtime.controller";
import { RuntimeService } from "./runtime.service";

/**
 * The rendered admin: the definition, the records it describes, and the one
 * place that decides where a request is served from.
 *
 * The engine's own classes carry no decorators, so they are provided by factory
 * — that is where dependency injection stops and the package begins. All of
 * them live here rather than being rebuilt by the features that write, because
 * there is one door into a customer's database and it is this module's
 * (DECISIONS #024): the actions and forms features import `ExecutorsService`
 * and get the same reader, the same builder and the same routing decision the
 * read side gets.
 */
@Module({
  imports: [
    AuthModule,
    ConnectionsModule,
    ConnectorSocketsModule,
    DefinitionsModule,
    ProjectsModule,
  ],
  controllers: [RuntimeController],
  providers: [
    RuntimeService,
    ExecutorsService,
    { provide: QueryBuilder, useFactory: () => new QueryBuilder() },
    { provide: HttpCall, useFactory: () => new HttpCall() },
    {
      provide: RecordReader,
      useFactory: (queries: QueryBuilder) => new RecordReader(queries),
      inject: [QueryBuilder],
    },
    {
      provide: RecordWriter,
      useFactory: (queries: QueryBuilder) => new RecordWriter(queries),
      inject: [QueryBuilder],
    },
    {
      provide: ActionRunner,
      useFactory: (reader: RecordReader, queries: QueryBuilder, http: HttpCall) =>
        new ActionRunner(reader, queries, http),
      inject: [RecordReader, QueryBuilder, HttpCall],
    },
  ],
  exports: [RuntimeService, ExecutorsService],
})
export class RuntimeModule {}
