import { Injectable } from "@nestjs/common";
import type { RecordDto, RecordId, RecordWrite, UserDto } from "@repanel/contracts";
import type { AuditWriter } from "@repanel/engine";
import { ActivityService } from "../activity/activity.service";
import { ExecutorsService } from "../runtime/executors.service";
import { SIGNS_NOTHING } from "../runtime/runtime-executor";
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
 * What it adds to the executor is the one thing neither rung can know: who is
 * writing. It takes the whole operator rather than their id, because an audit
 * event carries the address they were called by at the time — and it takes it
 * the same way whether the write is performed in this process or beside the
 * customer's database, which is what makes the log identical on both rungs.
 */
@Injectable()
export class RecordsService {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly activity: ActivityService,
    private readonly executors: ExecutorsService,
  ) {}

  async createRecord(
    actor: UserDto,
    projectKey: string,
    resourceKey: string,
    write: RecordWrite,
  ): Promise<RecordDto> {
    return (await this.writing(actor, projectKey)).createRecord(resourceKey, write);
  }

  async updateRecord(
    actor: UserDto,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    write: RecordWrite,
  ): Promise<RecordDto> {
    return (await this.writing(actor, projectKey)).updateRecord(resourceKey, id, write);
  }

  private async writing(actor: UserDto, projectKey: string) {
    const context = await this.runtime.readContext(actor.id, projectKey);

    return this.executors.for({
      ...context,
      audit: this.auditFor(actor, context.projectId),
      // A form fills columns; it never calls out to the customer's application.
      secret: SIGNS_NOTHING,
    });
  }

  /** Where this operator's writes to this project are accounted for. */
  private auditFor(actor: UserDto, projectId: string): AuditWriter {
    return (event) => this.activity.record(actor, projectId, event);
  }
}
