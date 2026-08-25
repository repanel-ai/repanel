import { Injectable } from "@nestjs/common";
import type { ActionResultDto, RecordId } from "@repanel/contracts";
import { ActionRunner } from "@repanel/engine";
import { ProjectsService } from "../projects/projects.service";
import { RuntimeService } from "../runtime/runtime.service";

/**
 * The rendered admin's write side. It sits beside the runtime rather than
 * inside it — the runtime never writes — and reaches through it for the
 * resolved definition, so the definition an action is read out of is the same
 * one the screen was drawn from.
 *
 * What it adds to the engine's runner is the one thing the engine cannot know:
 * this project's signing secret, fetched only when there is something to sign.
 */
@Injectable()
export class ActionsService {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly projects: ProjectsService,
    private readonly runner: ActionRunner,
  ) {}

  /** Runs one of a resource's declared actions against one record. */
  async run(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    actionKey: string,
  ): Promise<ActionResultDto> {
    const context = await this.runtime.readContext(ownerId, projectKey);

    return this.runner.run(
      { ...context, secret: () => this.projects.actionSecret(context.projectId) },
      resourceKey,
      id,
      actionKey,
    );
  }
}
