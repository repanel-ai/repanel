import type { ConnectionKind } from "@repanel/contracts";
import { ActionRunner, HttpCall, QueryBuilder, RecordReader, RecordWriter } from "@repanel/engine";
import type { ConnectionsService } from "../connections/connections.service";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import type { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import type { DefinitionsService } from "../definitions/definitions.service";
import type { ProjectsService } from "../projects/projects.service";
import { ExecutorsService } from "./executors.service";
import { RuntimeService } from "./runtime.service";

/**
 * A runtime on the direct rung, for the suites that are about what the engine
 * does rather than about where it runs.
 *
 * The connector transport it is given refuses everything, so a test that
 * accidentally routes a request over a socket fails loudly instead of quietly
 * proving nothing. Which rung a suite is on is stated here, once, rather than
 * assembled again in every `beforeEach`.
 */
export interface DirectRuntime {
  runtime: RuntimeService;
  /** The same factory the runtime uses, for the features that write. */
  executors: ExecutorsService;
}

export interface DirectRuntimeParts {
  projects: ProjectsService;
  definitions: DefinitionsService;
  pools: CustomerPoolService;
  /** The outbound caller an `httpCall` action uses; a real one by default. */
  http?: HttpCall;
}

export function directRuntime({ projects, definitions, pools, http }: DirectRuntimeParts): DirectRuntime {
  const queries = new QueryBuilder();
  const reader = new RecordReader(queries);
  const executors = new ExecutorsService(
    reader,
    new RecordWriter(queries),
    new ActionRunner(reader, queries, http ?? new HttpCall()),
    noConnector(),
  );

  return {
    runtime: new RuntimeService(projects, definitions, connectedBy("postgres-direct"), pools, executors),
    executors,
  };
}

/** A connections service that says one thing: which rung this project is on. */
export function connectedBy(kind: ConnectionKind): ConnectionsService {
  return { kindFor: () => Promise.resolve(kind) } as unknown as ConnectionsService;
}

/** A transport with nothing on the other end of it, and nothing to hide it. */
export function noConnector(): ConnectorSocketsService {
  return {
    execute: () => Promise.reject(new Error("this suite is on the direct rung; nothing dialled in")),
    notify: () => undefined,
    revoke: () => undefined,
    isConnected: () => false,
    lastSeenAt: () => undefined,
  } as unknown as ConnectorSocketsService;
}
