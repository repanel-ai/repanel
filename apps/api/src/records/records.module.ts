import { Module } from "@nestjs/common";
import { QueryBuilder, RecordWriter } from "@repanel/engine";
import { ActivityModule } from "../activity/activity.module";
import { AuthModule } from "../auth/auth.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { RecordsController } from "./records.controller";
import { RecordsService } from "./records.service";

/**
 * The rendered admin's forms. Like the actions feature it imports the runtime
 * module rather than building an engine of its own: the statement a form is
 * written by comes out of the same builder every read uses, so there is still
 * one place a statement is assembled (DECISIONS #024).
 */
@Module({
  imports: [ActivityModule, AuthModule, RuntimeModule],
  controllers: [RecordsController],
  providers: [
    RecordsService,
    {
      provide: RecordWriter,
      useFactory: (queries: QueryBuilder) => new RecordWriter(queries),
      inject: [QueryBuilder],
    },
  ],
})
export class RecordsModule {}
