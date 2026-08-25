import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DbModule } from "../db/db.module";
import { ProjectsModule } from "../projects/projects.module";
import { ActivityController } from "./activity.controller";
import { ActivityRepository } from "./activity.repository";
import { ActivityService } from "./activity.service";

/**
 * The audit log: what RePanel has done to a customer's records.
 *
 * It is imported by the two features that write — actions and records — and
 * imports neither of them. That direction is what keeps it acyclic and is also
 * the right one: a log is something a write reaches for, never the other way
 * round, and a log that had to know how a write works would be a log that broke
 * when one changed.
 */
@Module({
  imports: [AuthModule, DbModule, ProjectsModule],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityRepository],
  exports: [ActivityService],
})
export class ActivityModule {}
