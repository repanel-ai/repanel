import { Injectable } from "@nestjs/common";
import type { ActionResultDto, RecordId, UserDto } from "@repanel/contracts";
import { ActivityService } from "../activity/activity.service";
import { ProjectsService } from "../projects/projects.service";
import { ExecutorsService } from "../runtime/executors.service";
import { RuntimeService } from "../runtime/runtime.service";

/**
 * The rendered admin's write side. It sits beside the runtime rather than
 * inside it — the runtime never writes — and reaches through it for the
 * resolved definition, so the definition an action is read out of is the same
 * one the screen was drawn from.
 *
 * What it adds to the executor is the two things neither rung can know: this
 * project's signing secret, fetched only when there is something to sign, and
 * who is running the action. On the connector rung the secret is not used here
 * at all — it is handed to the connector when its session opens, because an
 * `httpCall` has to leave from beside the application it is calling — and this
 * closure is what the connector feature reads it through.
 */
@Injectable()
export class ActionsService {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly projects: ProjectsService,
    private readonly activity: ActivityService,
    private readonly executors: ExecutorsService,
  ) {}

  /** Runs one of a resource's declared actions against one record. */
  async run(
    actor: UserDto,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    actionKey: string,
  ): Promise<ActionResultDto> {
    const context = await this.runtime.readContext(actor.id, projectKey);

    return this.executors
      .for({
        ...context,
        secret: () => this.projects.actionSecret(context.projectId),
        audit: (event) => this.activity.record(actor, context.projectId, event),
      })
      .runAction(resourceKey, id, actionKey);
  }
}
