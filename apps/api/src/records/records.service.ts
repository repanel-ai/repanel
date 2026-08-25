import { Injectable } from "@nestjs/common";
import type { RecordDto, RecordId, RecordWrite, UserDto } from "@repanel/contracts";
import { RecordWriter, type AuditWriter } from "@repanel/engine";
import { ActivityService } from "../activity/activity.service";
import { RuntimeService } from "../runtime/runtime.service";

/**
 * The rendered admin's forms. It sits beside the runtime rather than inside it
 * — the runtime never writes — and reaches through it for the resolved
 * definition, so a record is written against exactly the definition the form
 * was drawn from: the same owner check, the same published version.
 *
 * There is no authorization of its own here, and that is the point: "may this
 * caller reach this admin" has one answer, and it is `RuntimeService`'s.
 *
 * What it adds to the engine's writer is the one thing the engine cannot know:
 * who is writing. It takes the whole operator rather than their id, because an
 * audit event carries the address they were called by at the time.
 */
@Injectable()
export class RecordsService {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly activity: ActivityService,
    private readonly writer: RecordWriter,
  ) {}

  async createRecord(
    actor: UserDto,
    projectKey: string,
    resourceKey: string,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const context = await this.runtime.readContext(actor.id, projectKey);

    return this.writer.createRecord(
      { ...context, audit: this.auditFor(actor, context.projectId) },
      resourceKey,
      write,
    );
  }

  async updateRecord(
    actor: UserDto,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const context = await this.runtime.readContext(actor.id, projectKey);

    return this.writer.updateRecord(
      { ...context, audit: this.auditFor(actor, context.projectId) },
      resourceKey,
      id,
      write,
    );
  }

  /** Where this operator's writes to this project are accounted for. */
  private auditFor(actor: UserDto, projectId: string): AuditWriter {
    return (event) => this.activity.record(actor, projectId, event);
  }
}
