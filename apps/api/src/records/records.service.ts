import { Injectable } from "@nestjs/common";
import type { RecordDto, RecordId, RecordWrite } from "@repanel/contracts";
import { RecordWriter } from "@repanel/engine";
import { RuntimeService } from "../runtime/runtime.service";

/**
 * The rendered admin's forms. It sits beside the runtime rather than inside it
 * — the runtime never writes — and reaches through it for the resolved
 * definition, so a record is written against exactly the definition the form
 * was drawn from: the same owner check, the same published version.
 *
 * There is no authorization of its own here, and that is the point: "may this
 * caller reach this admin" has one answer, and it is `RuntimeService`'s.
 */
@Injectable()
export class RecordsService {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly writer: RecordWriter,
  ) {}

  async createRecord(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const context = await this.runtime.readContext(ownerId, projectKey);

    return this.writer.createRecord(context, resourceKey, write);
  }

  async updateRecord(
    ownerId: string,
    projectKey: string,
    resourceKey: string,
    id: RecordId,
    write: RecordWrite,
  ): Promise<RecordDto> {
    const context = await this.runtime.readContext(ownerId, projectKey);

    return this.writer.updateRecord(context, resourceKey, id, write);
  }
}
