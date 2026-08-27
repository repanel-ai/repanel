import { Module } from "@nestjs/common";
import { ActivityModule } from "../activity/activity.module";
import { AuthModule } from "../auth/auth.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { RecordsController } from "./records.controller";
import { RecordsService } from "./records.service";

/**
 * The rendered admin's forms. Like the actions feature it imports the runtime
 * module rather than building an engine of its own: a form is written through
 * the same executor every read uses, so there is still one place a statement is
 * assembled and one place that decides which rung assembles it (DECISIONS #024).
 */
@Module({
  imports: [ActivityModule, AuthModule, RuntimeModule],
  controllers: [RecordsController],
  providers: [RecordsService],
})
export class RecordsModule {}
