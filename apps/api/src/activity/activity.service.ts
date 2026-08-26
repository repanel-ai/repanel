import { Injectable } from "@nestjs/common";
import type { ActivityListDto, ActivityQuery, RecordId, UserDto } from "@repanel/contracts";
import type { AuditEvent } from "@repanel/engine";
import { ProjectsService } from "../projects/projects.service";
import { toActivityEvent } from "./activity.mapper";
import { ActivityRepository } from "./activity.repository";

/**
 * Who did what, when.
 *
 * The engine says what happened; this says who it happened for and files it.
 * That split is the whole design: `@repanel/engine` is given a definition, a
 * database and a way to account for a write, and looks nothing up for itself —
 * so the operator's identity, the project and the clock reach an event here,
 * where they were already known, rather than being fetched inside a package
 * that has no business knowing them.
 */
@Injectable()
export class ActivityService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly repository: ActivityRepository,
  ) {}

  /**
   * Files what the engine just did. There is no authorization here and there
   * must not be: the caller was authorized before the write it is now
   * accounting for, and a check that could refuse at this point would be a
   * check that could leave a write unrecorded.
   */
  async record(actor: UserDto, projectId: string, event: AuditEvent): Promise<void> {
    await this.repository.insert({
      projectId,
      actorUserId: actor.id,
      actorEmail: actor.email,
      resourceKey: event.resourceKey,
      recordPk: event.recordId === null ? null : String(event.recordId),
      kind: event.kind,
      actionKey: event.actionKey,
      before: event.before ?? null,
      after: event.after ?? null,
      outcome: event.outcome,
      reason: event.reason,
    });
  }

  /**
   * One record's own history, newest first.
   *
   * It asks the same question of membership every other runtime read asks, and
   * asks nothing about the definition: a project's log is readable whether or
   * not there is a published admin to read it beside, because the case where
   * one has just been taken down is exactly the case somebody wants the log.
   */
  async listForRecord(
    userId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    query: ActivityQuery,
  ): Promise<ActivityListDto> {
    const project = await this.projects.requireMemberByKey(projectKey, userId, "operator");

    const { rows, total } = await this.repository.listForRecord(
      project.id,
      resourceKey,
      String(id),
      query.page,
      query.pageSize,
    );

    return {
      events: rows.map(toActivityEvent),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
