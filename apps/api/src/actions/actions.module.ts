import { Module } from "@nestjs/common";
import { ActionRunner, HttpCall, QueryBuilder, RecordReader } from "@repanel/engine";
import { ActivityModule } from "../activity/activity.module";
import { AuthModule } from "../auth/auth.module";
import { ProjectsModule } from "../projects/projects.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";

/**
 * The rendered admin's write side. It imports the runtime module rather than
 * building its own engine: the reader an `httpCall` fills its address from and
 * the builder a `dbUpdate` is written by are the same instances the read side
 * uses.
 */
@Module({
  imports: [ActivityModule, AuthModule, ProjectsModule, RuntimeModule],
  controllers: [ActionsController],
  providers: [
    ActionsService,
    { provide: HttpCall, useFactory: () => new HttpCall() },
    {
      provide: ActionRunner,
      useFactory: (reader: RecordReader, queries: QueryBuilder, http: HttpCall) =>
        new ActionRunner(reader, queries, http),
      inject: [RecordReader, QueryBuilder, HttpCall],
    },
  ],
})
export class ActionsModule {}
