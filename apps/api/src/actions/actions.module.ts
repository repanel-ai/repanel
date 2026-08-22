import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ConnectionsModule } from "../connections/connections.module";
import { ProjectsModule } from "../projects/projects.module";
import { RuntimeModule } from "../runtime/runtime.module";
import { ActionsController } from "./actions.controller";
import { ActionsService } from "./actions.service";
import { HttpCallService } from "./http-call.service";

/**
 * The rendered admin's write side. It sits beside the runtime rather than
 * inside it — the runtime never writes, and a signing secret and an outbound
 * HTTP client are nothing to do with reading records — and imports it, so the
 * definition an action is read out of is the same one the screen was drawn
 * from, resolved once and in one place.
 */
@Module({
  imports: [AuthModule, ConnectionsModule, ProjectsModule, RuntimeModule],
  controllers: [ActionsController],
  providers: [ActionsService, HttpCallService],
})
export class ActionsModule {}
