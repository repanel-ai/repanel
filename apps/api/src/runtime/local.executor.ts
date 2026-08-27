import type {
  ActionResultDto,
  ListRecordsQuery,
  OptionsQuery,
  RecordDto,
  RecordId,
  RecordListDto,
  RecordOptionDto,
  RecordWrite,
} from "@repanel/contracts";
import type { ActionRunner, RecordReader, RecordWriter } from "@repanel/engine";
import type { RuntimeExecutor, ServingContext } from "./runtime-executor";

/**
 * The direct rung: the engine, in this process, over a pool this deployment
 * holds a connection string for.
 *
 * It is a rename and nothing more. Every line of it is the call `RuntimeService`
 * and its two neighbours already made, moved behind the port so that the other
 * rung has something to be the other implementation of.
 */
export class LocalExecutor implements RuntimeExecutor {
  constructor(
    private readonly reader: RecordReader,
    private readonly writer: RecordWriter,
    private readonly runner: ActionRunner,
    private readonly context: ServingContext,
  ) {}

  listRecords(resourceKey: string, query: ListRecordsQuery): Promise<RecordListDto> {
    return this.reader.listRecords(this.context, resourceKey, query);
  }

  getRecord(resourceKey: string, id: RecordId): Promise<RecordDto> {
    return this.reader.getRecord(this.context, resourceKey, id);
  }

  listOptions(resourceKey: string, query: OptionsQuery): Promise<RecordOptionDto[]> {
    return this.reader.listOptions(this.context, resourceKey, query);
  }

  listRelated(
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    return this.reader.listRelated(this.context, resourceKey, id, relationshipKey, query);
  }

  createRecord(resourceKey: string, write: RecordWrite): Promise<RecordDto> {
    return this.writer.createRecord(this.context, resourceKey, write);
  }

  updateRecord(resourceKey: string, id: RecordId, write: RecordWrite): Promise<RecordDto> {
    return this.writer.updateRecord(this.context, resourceKey, id, write);
  }

  runAction(resourceKey: string, id: RecordId, actionKey: string): Promise<ActionResultDto> {
    return this.runner.run(this.context, resourceKey, id, actionKey);
  }
}
