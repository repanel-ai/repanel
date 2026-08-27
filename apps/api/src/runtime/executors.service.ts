import { Injectable } from "@nestjs/common";
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
import { ActionRunner, RecordReader, RecordWriter } from "@repanel/engine";
import { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import { ConnectorExecutor } from "./connector.executor";
import { LocalExecutor } from "./local.executor";
import type { RuntimeExecutor, ServingContext } from "./runtime-executor";

/**
 * Which rung a project's admin is served on.
 *
 * The choice is made per request rather than per context, and asked for at the
 * same moment the pool would have been: the connection is read when a statement
 * is about to be sent, so a resource this admin does not have is still answered
 * as one whether or not there is anything behind it.
 *
 * Everything above this — authorization, the published definition, the audit
 * log — is the same code on both rungs. Everything below it is the same engine.
 * This is the only place in the API that knows there are two (DECISIONS #064).
 */
@Injectable()
export class ExecutorsService {
  constructor(
    private readonly reader: RecordReader,
    private readonly writer: RecordWriter,
    private readonly runner: ActionRunner,
    private readonly sockets: ConnectorSocketsService,
  ) {}

  for(context: ServingContext): RuntimeExecutor {
    return new RoutedExecutor(
      () => context.connectionKind(),
      new LocalExecutor(this.reader, this.writer, this.runner, context),
      new ConnectorExecutor(this.sockets, context),
    );
  }
}

/** Reads the connection once a request is ready to go, and sends it that way. */
class RoutedExecutor implements RuntimeExecutor {
  constructor(
    private readonly kind: () => Promise<string>,
    private readonly local: RuntimeExecutor,
    private readonly connector: RuntimeExecutor,
  ) {}

  async listRecords(resourceKey: string, query: ListRecordsQuery): Promise<RecordListDto> {
    return (await this.pick()).listRecords(resourceKey, query);
  }

  async getRecord(resourceKey: string, id: RecordId): Promise<RecordDto> {
    return (await this.pick()).getRecord(resourceKey, id);
  }

  async listOptions(resourceKey: string, query: OptionsQuery): Promise<RecordOptionDto[]> {
    return (await this.pick()).listOptions(resourceKey, query);
  }

  async listRelated(
    resourceKey: string,
    id: RecordId,
    relationshipKey: string,
    query: ListRecordsQuery,
  ): Promise<RecordListDto> {
    return (await this.pick()).listRelated(resourceKey, id, relationshipKey, query);
  }

  async createRecord(resourceKey: string, write: RecordWrite): Promise<RecordDto> {
    return (await this.pick()).createRecord(resourceKey, write);
  }

  async updateRecord(resourceKey: string, id: RecordId, write: RecordWrite): Promise<RecordDto> {
    return (await this.pick()).updateRecord(resourceKey, id, write);
  }

  async runAction(resourceKey: string, id: RecordId, actionKey: string): Promise<ActionResultDto> {
    return (await this.pick()).runAction(resourceKey, id, actionKey);
  }

  private async pick(): Promise<RuntimeExecutor> {
    return (await this.kind()) === "connector" ? this.connector : this.local;
  }
}
