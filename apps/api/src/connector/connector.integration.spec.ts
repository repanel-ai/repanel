import { Logger } from "@nestjs/common";
import type { HttpAdapterHost } from "@nestjs/core";
import {
  CONTRACTS_VERSION,
  cloudFrameSchema,
  descriptorSchema,
  validateDefinition,
  type Answer,
  type CloudFrame,
  type Definition,
  type DefinitionInput,
  type Descriptor,
  type FrameAuditEvent,
  type ProjectDto,
  type Question,
  type RecordDto,
  type RecordListDto,
  type RecordOptionDto,
  type UserDto,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import {
  ActionRunner,
  CustomerPool,
  DomainError,
  HttpCall,
  QueryBuilder,
  RecordReader,
  RecordWriter,
  ValidationFailedError as EngineValidationFailed,
  indexResources,
  type ActionContext,
  type AuditEvent,
} from "@repanel/engine";
import {
  createServer,
  request as httpRequest,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { Client, type Pool } from "pg";
import { WebSocket } from "ws";
import { ActionsService } from "../actions/actions.service";
import type { ActivityService } from "../activity/activity.service";
import type { ConnectionsService } from "../connections/connections.service";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import { hashConnectorToken } from "../connector-sockets/connector-token";
import type { ConnectorTokensRepository } from "../connector-sockets/connector-tokens.repository";
import type { DefinitionsService } from "../definitions/definitions.service";
import {
  ConnectorOfflineError,
  ConnectorTimeoutError,
  NotFoundError,
  ValidationFailedError,
} from "../errors/domain-errors";
import type { ProjectsService } from "../projects/projects.service";
import { RecordsService } from "../records/records.service";
import { ExecutorsService } from "../runtime/executors.service";
import { RuntimeService } from "../runtime/runtime.service";

/**
 * The connector rung, end to end, over a real socket against a real Postgres.
 *
 * Cloud here is the API's own routing — the same `RuntimeService`, the same
 * executors, the same exception categories — and the far end is the engine
 * running against a schema this suite owns, reached only through the channel.
 * There is no connection string anywhere on the Cloud side of it, which is the
 * property the whole rung exists for.
 *
 * The connector is written out below rather than imported: `@repanel/cli` ships
 * the real one, and an app may not depend on it. What both ends share is the
 * frame contract, which is what is actually under test — this side proves Cloud
 * speaks it, and `packages/cli/src/connector` proves the shipped connector does.
 *
 * Runs only when `TEST_CUSTOMER_DATABASE_URL` names a database, for the reason
 * the query engine's own suite does: what a hop, a driver and a server actually
 * do cannot be asserted against a stub.
 */
const CUSTOMER_DATABASE_URL = process.env.TEST_CUSTOMER_DATABASE_URL;
const describeAgainstPostgres = CUSTOMER_DATABASE_URL ? describe : describe.skip;

// A statement gets five seconds and the hop gets eight, so a timeout case
// cannot fit inside jest's default of five.
jest.setTimeout(60_000);

const SCHEMA = "repanel_connector_spec";

const PROJECT: ProjectDto = {
  id: "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11",
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

const OPERATOR: UserDto = { id: "operator-1", email: "operator@repanel.test", name: "Ops" };
const TOKEN = "rpc_0123456789abcdefghijklmnopqrstuvwxyzABCD";
const ACTION_SECRET = "connector-spec-secret";

const ACME = "11111111-1111-4111-8111-111111111111";
const ADA = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";

const SETUP = `
create schema ${SCHEMA};

create table ${SCHEMA}.organizations (
  id uuid primary key,
  name text not null,
  plan text not null,
  billing_email text,
  settings jsonb,
  created_at timestamptz not null
);

create table ${SCHEMA}.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  status text not null default 'invited',
  password_hash text,
  organization_id uuid references ${SCHEMA}.organizations(id),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  avatar_url text,
  trial_ends_on date,
  login_count integer not null default 0,
  preferences jsonb
);

create table ${SCHEMA}.orders (
  id uuid primary key,
  reference text not null,
  user_id uuid references ${SCHEMA}.users(id),
  status text not null,
  total_cents bigint not null,
  metadata jsonb,
  placed_at timestamptz not null
);

insert into ${SCHEMA}.organizations (id, name, plan, billing_email, settings, created_at) values
  ('${ACME}', 'Acme', 'pro', 'billing@acme.test', '{"seats":40}', '2026-01-05T09:00:00Z');

insert into ${SCHEMA}.users (id, email, name, status, password_hash, organization_id, is_active, notes, created_at, login_count) values
  ('${ADA}', 'ada@acme.test', 'Ada', 'active', 'scrypt$do-not-leak', '${ACME}', true, 'founding user', '2026-03-01T09:00:00Z', 1284),
  ('${BOB}', 'bob@acme.test', 'Bob', 'invited', 'scrypt$do-not-leak', '${ACME}', true, null, '2026-02-01T09:00:00Z', 12);

insert into ${SCHEMA}.orders (id, reference, user_id, status, total_cents, metadata, placed_at) values
  ('dddddddd-1111-4111-8111-dddddddddddd', 'REF-1', '${ADA}', 'paid', 1050, '{"channel":"web"}', '2026-03-02T09:00:00Z');
`;

/** The same database, seen only through the schema this spec owns. */
function scopedTo(dsn: string, schema: string): string {
  const separator = dsn.includes("?") ? "&" : "?";
  return `${dsn}${separator}options=${encodeURIComponent(`-c search_path=${schema}`)}`;
}

/** The fixture, with its one outbound action pointed at this suite's own endpoint. */
function definitionCalling(url: string): Definition {
  const input = JSON.parse(JSON.stringify(saasDefinition)) as DefinitionInput;
  const users = input.resources.find((resource) => resource.key === "users");
  const call = users?.actions?.find((action) => action.key === "resend_invite");
  if (!call || call.kind !== "httpCall") throw new Error("the fixture lost its httpCall action");
  call.url = url;

  const result = validateDefinition(input);
  if (!result.valid) throw new Error(`the fixture is not valid: ${JSON.stringify(result.errors)}`);
  return result.definition;
}

/**
 * A connector, in as many lines as the contract takes.
 *
 * It is the shipped connector's shape without its terminal: open a session,
 * hold the definition and the secret in memory, run the engine against the
 * descriptor that arrives, send back the DTO and whatever the engine filed.
 */
class TestConnector {
  private socket?: WebSocket;
  private definition?: Definition;
  private secret = "";
  private version = 0;
  /** Receives descriptors and answers none of them, for the kill case. */
  stalled = false;

  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly pool: () => Promise<Pool>,
    private readonly engine: {
      reader: RecordReader;
      writer: RecordWriter;
      runner: ActionRunner;
    },
    /** Every frame that actually crossed, in both directions. The gate reads it. */
    private readonly wire: string[],
  ) {}

  /** Sends a frame, and records that it went. */
  private put(frame: unknown): void {
    const payload = JSON.stringify(frame);
    this.wire.push(payload);
    this.socket?.send(payload);
  }

  open(): Promise<void> {
    const socket = new WebSocket(this.url, {
      headers: {
        authorization: `Bearer ${this.token}`,
        "x-repanel-contracts-version": CONTRACTS_VERSION,
      },
    });
    this.socket = socket;
    socket.on("error", () => undefined);

    return new Promise<void>((resolve, reject) => {
      socket.on("unexpected-response", (_request, response) => {
        reject(new Error(`refused with HTTP ${response.statusCode ?? 0}`));
      });
      socket.on("open", () => {
        socket.on("message", (data) => void this.receive(String(data)));
        this.ask({ kind: "openSession" })
          .then((answer) => {
            if (answer.kind !== "session") throw new Error("not a session");
            this.secret = answer.actionSecret;
            this.take(answer.definition);
            resolve();
          })
          .catch(reject);
      });
    });
  }

  /** Cuts the socket the way a killed process does: no close frame, no goodbye. */
  kill(): void {
    this.socket?.terminate();
  }

  close(): void {
    this.socket?.close(1000, "done");
  }

  private pending = new Map<number, (answer: Answer) => void>();
  private nextId = 1;

  private ask(question: Question): Promise<Answer> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise<Answer>((resolve) => {
      this.pending.set(id, resolve);
      this.put({ frame: "ask", id, question });
    });
  }

  private take(published: { version: number; payload: unknown } | null): void {
    if (!published) {
      this.definition = undefined;
      this.version = 0;
      return;
    }
    const result = validateDefinition(published.payload);
    if (!result.valid) throw new Error("cloud sent a definition that does not validate");
    this.definition = result.definition;
    this.version = published.version;
  }

  private async receive(payload: string): Promise<void> {
    this.wire.push(payload);
    const parsed = cloudFrameSchema.safeParse(JSON.parse(payload) as unknown);
    if (!parsed.success) return;
    const frame: CloudFrame = parsed.data;

    if (frame.frame === "heartbeat") return;
    if (frame.frame === "answer") {
      const waiting = this.pending.get(frame.id);
      if (waiting && frame.outcome.ok) {
        this.pending.delete(frame.id);
        waiting(frame.outcome.answer);
      }
      return;
    }
    if (frame.frame === "notify") {
      const answer = await this.ask({ kind: "pullDefinition" });
      if (answer.kind === "definition") this.take(answer.definition);
      return;
    }

    if (this.stalled) return;
    if (this.version < frame.definitionVersion) {
      const answer = await this.ask({ kind: "pullDefinition" });
      if (answer.kind === "definition") this.take(answer.definition);
    }
    await this.serve(frame.id, frame.descriptor);
  }

  private async serve(id: number, descriptor: Descriptor): Promise<void> {
    const definition = this.definition;
    if (!definition) return;

    const audit: FrameAuditEvent[] = [];
    const context: ActionContext = {
      resources: indexResources(definition),
      pool: this.pool,
      audit: (event) => {
        audit.push(event as FrameAuditEvent);
        return Promise.resolve();
      },
      secret: () => Promise.resolve(this.secret),
    };

    let outcome;
    try {
      outcome = { ok: true as const, result: await this.run(context, descriptor) };
    } catch (failure) {
      outcome = { ok: false as const, error: errorFrom(failure) };
    }

    this.put({ frame: "result", id, outcome, audit });
  }

  private run(context: ActionContext, descriptor: Descriptor): Promise<unknown> {
    const { reader, writer, runner } = this.engine;
    switch (descriptor.kind) {
      case "listRecords":
        return reader.listRecords(context, descriptor.resourceKey, descriptor.query);
      case "getRecord":
        return reader.getRecord(context, descriptor.resourceKey, descriptor.id);
      case "listOptions":
        return reader.listOptions(context, descriptor.resourceKey, descriptor.query);
      case "listRelated":
        return reader.listRelated(
          context,
          descriptor.resourceKey,
          descriptor.id,
          descriptor.relationshipKey,
          descriptor.query,
        );
      case "createRecord":
        return writer.createRecord(context, descriptor.resourceKey, descriptor.write);
      case "updateRecord":
        return writer.updateRecord(context, descriptor.resourceKey, descriptor.id, descriptor.write);
      case "runAction":
        return runner.run(context, descriptor.resourceKey, descriptor.id, descriptor.actionKey);
    }
  }
}

function errorFrom(failure: unknown): { code: string; message: string; details?: unknown[] } {
  if (failure instanceof EngineValidationFailed) {
    return { code: failure.code, message: failure.message, details: [...failure.details] };
  }
  if (failure instanceof DomainError) return { code: failure.code, message: failure.message };
  return { code: "internal_error", message: "The connector could not serve this request." };
}

describeAgainstPostgres("the connector rung", () => {
  const dsn = CUSTOMER_DATABASE_URL ?? "";
  const page = { page: 1, pageSize: 25 };

  let admin: Client;
  let cloud: Server;
  let sockets: ConnectorSocketsService;
  let connector: TestConnector;
  let pool: CustomerPool;
  let application: Server;
  let runtime: RuntimeService;
  let records: RecordsService;
  let actions: ActionsService;

  /** Every frame that crossed, in both directions, for the gate at the bottom. */
  const wire: string[] = [];
  /** Every audit event Cloud filed, which is the whole of what 028 captures. */
  const filed: AuditEvent[] = [];
  /** Every request the customer's "application" received from the connector. */
  const called: Array<{ path: string; signature: string | undefined }> = [];

  let definition: Definition;
  let version = 1;

  beforeAll(async () => {
    // Nest's logger writes to stdout, and a suite's output has to stay clean.
    Logger.overrideLogger(false);

    admin = new Client({ connectionString: dsn });
    await admin.connect();
    await admin.query(`drop schema if exists ${SCHEMA} cascade`);
    await admin.query(SETUP);

    // The customer's own application, which only the connector can reach.
    application = createServer((request: IncomingMessage, response: ServerResponse) => {
      called.push({
        path: request.url ?? "",
        // `Repanel-Signature`, lower-cased the way node hands headers over
        // (SIGNING.md). Its presence is the proof the secret reached the far end.
        signature: request.headers["repanel-signature"] as string | undefined,
      });
      response.writeHead(204).end();
    });
    await listen(application);
    definition = definitionCalling(`http://127.0.0.1:${portOf(application)}/resend/{id}`);

    // Cloud: the socket transport on a real server, and the API's own routing.
    cloud = createServer();
    sockets = new ConnectorSocketsService(
      {
        findByHash: (hash: string) =>
          Promise.resolve(
            hash === hashConnectorToken(TOKEN)
              ? { id: "t", projectId: PROJECT.id, tokenHash: hash, createdAt: new Date(), lastSeenAt: null }
              : undefined,
          ),
        recordSeen: () => Promise.resolve(),
      } as unknown as ConnectorTokensRepository,
      { httpAdapter: { getHttpServer: () => cloud } } as unknown as HttpAdapterHost,
    );
    sockets.answerQuestions((_projectId, question): Promise<Answer> => {
      const published = { version, payload: definition };
      return Promise.resolve(
        question.kind === "openSession"
          ? { kind: "session", actionSecret: ACTION_SECRET, definition: published }
          : { kind: "definition", definition: published },
      );
    });
    sockets.onApplicationBootstrap();
    await listen(cloud);

    const queries = new QueryBuilder();
    const reader = new RecordReader(queries);
    const executors = new ExecutorsService(
      reader,
      new RecordWriter(queries),
      new ActionRunner(reader, queries, new HttpCall()),
      sockets,
    );
    runtime = new RuntimeService(
      { requireMemberByKey: () => Promise.resolve(PROJECT) } as unknown as ProjectsService,
      {
        getPublished: () =>
          Promise.resolve({ payload: definition, version, publishedAt: "2026-08-27T09:00:00.000Z" }),
      } as unknown as DefinitionsService,
      // Every project here is on the connector rung, and there is no pool.
      { kindFor: () => Promise.resolve("connector" as const) } as unknown as ConnectionsService,
      {
        poolFor: () => Promise.reject(new Error("the connector rung opens no pool in Cloud")),
      } as unknown as CustomerPoolService,
      executors,
    );
    const activity = {
      record: (_actor: UserDto, _projectId: string, event: AuditEvent) => {
        filed.push(event);
        return Promise.resolve();
      },
    } as unknown as ActivityService;
    records = new RecordsService(runtime, activity, executors);
    actions = new ActionsService(
      runtime,
      { actionSecret: () => Promise.resolve(ACTION_SECRET) } as unknown as ProjectsService,
      activity,
      executors,
    );

    // The connector: the engine, beside the database, holding the only DSN.
    pool = new CustomerPool({ resolveDsn: () => Promise.resolve(scopedTo(dsn, SCHEMA)) });
    const farQueries = new QueryBuilder();
    const farReader = new RecordReader(farQueries);
    connector = new TestConnector(
      `ws://127.0.0.1:${portOf(cloud)}/connector`,
      TOKEN,
      () => pool.poolFor("customer"),
      {
        reader: farReader,
        writer: new RecordWriter(farQueries),
        runner: new ActionRunner(farReader, farQueries, new HttpCall()),
      },
      wire,
    );
    await connector.open();
  });

  afterAll(async () => {
    connector?.close();
    sockets?.onModuleDestroy();
    await pool?.close();
    await closed(cloud);
    await closed(application);
    await admin?.query(`drop schema if exists ${SCHEMA} cascade`);
    await admin?.end();
    Logger.overrideLogger(true);
  });

  beforeEach(() => {
    filed.length = 0;
    called.length = 0;
  });

  describe("reading", () => {
    it("serves a page of records through the connector", async () => {
      const listed = (await runtime.listRecords(OPERATOR.id, PROJECT.key, "users", page)) as RecordListDto;

      expect(listed.total).toBe(2);
      // Newest first, which is the definition's own default sort.
      expect(listed.records.map((record) => record.values.email)).toEqual([
        "ada@acme.test",
        "bob@acme.test",
      ]);
    });

    it("never sends a sensitive column, on this rung as on the other", async () => {
      const listed = await runtime.listRecords(OPERATOR.id, PROJECT.key, "users", page);

      expect(JSON.stringify(listed)).not.toContain("do-not-leak");
    });

    it("serves one record in full", async () => {
      const record = (await runtime.getRecord(OPERATOR.id, PROJECT.key, "users", ADA)) as RecordDto;

      expect(record.values.name).toBe("Ada");
      expect(record.values.organization_id).toEqual({ id: ACME, label: "Acme" });
    });

    it("serves a related page, narrowed to the record it hangs off", async () => {
      const related = await runtime.listRelated(OPERATOR.id, PROJECT.key, "users", ADA, "orders", page);

      expect(related.total).toBe(1);
      expect(related.records[0]?.values.reference).toBe("REF-1");
    });

    it("serves the options a relation picker offers", async () => {
      const options = (await runtime.listOptions(OPERATOR.id, PROJECT.key, "organizations", {
        q: "acm",
      })) as RecordOptionDto[];

      expect(options).toEqual([{ id: ACME, label: "Acme" }]);
    });

    it("answers a resource this admin does not have without leaving Cloud", async () => {
      const before = wire.length;

      await expect(runtime.listRecords(OPERATOR.id, PROJECT.key, "nope", page)).rejects.toBeInstanceOf(
        NotFoundError,
      );
      expect(wire).toHaveLength(before);
    });
  });

  describe("writing", () => {
    it("creates a record and files the event Cloud's own log keeps", async () => {
      const created = await records.createRecord(OPERATOR, PROJECT.key, "users", {
        values: { email: "cy@acme.test", name: "Cy" },
      });

      expect(created.values.email).toBe("cy@acme.test");
      expect(filed).toHaveLength(1);
      expect(filed[0]).toMatchObject({
        kind: "create",
        resourceKey: "users",
        outcome: "ok",
        before: null,
        after: { email: "cy@acme.test", name: "Cy" },
      });
    });

    it("updates a record, and the event carries both sides of the write", async () => {
      await records.updateRecord(OPERATOR, PROJECT.key, "users", BOB, { values: { name: "Bobby" } });

      expect(filed[0]).toMatchObject({
        kind: "update",
        recordId: BOB,
        outcome: "ok",
        before: { name: "Bob" },
        after: { name: "Bobby" },
      });
    });

    it("brings a form's refusal back with the paths the renderer puts it under", async () => {
      const refusal = await refusalFrom(
        records.updateRecord(OPERATOR, PROJECT.key, "users", ADA, { values: { email: "not-an-email" } }),
      );

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect((refusal as ValidationFailedError).details[0]?.path).toBe("values.email");
      // A refused write is still a write that was attempted, and is still filed.
      expect(filed[0]).toMatchObject({ kind: "update", outcome: "refused" });
    });
  });

  describe("acting", () => {
    it("runs a dbUpdate action and files what it moved", async () => {
      const result = await actions.run(OPERATOR, PROJECT.key, "users", ADA, "suspend");

      expect(result).toEqual({ ok: true, label: "Suspend" });
      expect(filed[0]).toMatchObject({
        kind: "action",
        actionKey: "suspend",
        outcome: "ok",
        before: { status: "active" },
        after: { status: "suspended" },
      });
    });

    it("calls the customer's application from the connector, signed with the secret it was given", async () => {
      await actions.run(OPERATOR, PROJECT.key, "users", BOB, "resend_invite");

      // The endpoint is only reachable from the connector's own process, so
      // that it was reached at all is the proof that egress happens there.
      expect(called).toEqual([{ path: `/resend/${BOB}`, signature: expect.any(String) }]);
      expect(filed[0]).toMatchObject({ kind: "action", actionKey: "resend_invite", outcome: "ok" });
    });
  });

  describe("when the connector is not there", () => {
    it("answers with the offline category, and asks nothing of any database", async () => {
      connector.kill();
      await settled();

      const refusal = await refusalFrom(runtime.listRecords(OPERATOR.id, PROJECT.key, "users", page));

      expect(refusal).toBeInstanceOf(ConnectorOfflineError);
      expect(refusal.message).not.toContain(SCHEMA);
    });

    it("fails a request that was already in flight, rather than leaving it hanging", async () => {
      connector.stalled = true;
      const inFlight = refusalFrom(runtime.listRecords(OPERATOR.id, PROJECT.key, "users", page));
      await settled();

      connector.kill();

      // Well inside the hop's own deadline: the channel closing is an answer,
      // not something to wait out.
      const refusal = await withinMs(inFlight, 2_000);
      expect(refusal).toBeInstanceOf(ConnectorOfflineError);
      connector.stalled = false;
    });

    it("recovers when the connector comes back, with nobody having done anything", async () => {
      await connector.open();

      const listed = await runtime.listRecords(OPERATOR.id, PROJECT.key, "users", page);
      expect(listed.records.length).toBeGreaterThan(0);
    });
  });

  describe("the definition both ends serve", () => {
    it("pulls a newly published version before serving the request that names it", async () => {
      version += 1;
      sockets.notify(PROJECT.id, { kind: "definitionPublished", version });
      await settled();

      const listed = await runtime.listRecords(OPERATOR.id, PROJECT.key, "users", page);
      expect(listed.total).toBeGreaterThan(0);
    });
  });

  describe("a build that speaks a different contract", () => {
    it("is refused before a socket exists, and told which two versions disagree", async () => {
      const refusal = await refusalFrom(
        handshake(`ws://127.0.0.1:${portOf(cloud)}/connector`, TOKEN, "0.0.1-ancient"),
      );

      expect(refusal.message).toContain("426");
      expect(await bodyOfRefusal(portOf(cloud), TOKEN, "0.0.1-ancient")).toMatchObject({
        error: {
          code: "connector_version_mismatch",
          message: expect.stringContaining(CONTRACTS_VERSION),
        },
      });
    });

    it("refuses a token nobody minted, without saying which part was wrong", async () => {
      const refusal = await refusalFrom(
        handshake(`ws://127.0.0.1:${portOf(cloud)}/connector`, "rpc_zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz", CONTRACTS_VERSION),
      );

      expect(refusal.message).toContain("401");
    });
  });

  /**
   * The gate the whole rung rests on: no SQL crossed the wire.
   *
   * The claim is structural — the frame union has no member that could carry a
   * statement — and these are the assertions that would notice if that stopped
   * being true. They read the frames that actually crossed during everything
   * above, which is the only evidence that settles it.
   *
   * The scan is over *descriptors* rather than over every frame, and that is
   * deliberate rather than convenient. A result carries the customer's own rows
   * and a definition carries the customer's own vocabulary — `writes.update` is
   * in every definition ever written — so scanning those would be scanning
   * their data for our words. What matters is the one direction that could
   * instruct: what Cloud asked for.
   */
  describe("no SQL crosses the wire", () => {
    /** A statement is recognizable by its shape, never by one of its words. */
    const STATEMENTS = [
      /\bselect\b[\s\S]*\bfrom\b/i,
      /\binsert\s+into\b/i,
      /\bupdate\b[\s\S]*\bset\b/i,
      /\bdelete\s+from\b/i,
      /\bdrop\s+(table|schema|database)\b/i,
      /\bunion\s+select\b/i,
      /;\s*--/,
    ];

    /** Every request Cloud made, read back out of what crossed. */
    function descriptors(): Descriptor[] {
      return wire.flatMap((payload) => {
        const parsed = cloudFrameSchema.safeParse(JSON.parse(payload) as unknown);
        return parsed.success && parsed.data.frame === "execute" ? [parsed.data.descriptor] : [];
      });
    }

    it("made requests, and every one of them was a descriptor", () => {
      const asked = descriptors();

      expect(asked.length).toBeGreaterThan(8);
      for (const descriptor of asked) {
        // Re-parsed strictly: a frame carrying one extra field would not
        // survive this, which is the whole of why the union is strict.
        expect(descriptorSchema.safeParse(descriptor).success).toBe(true);
      }
    });

    it("addressed records by keys that could not be statements", () => {
      for (const descriptor of descriptors()) {
        for (const key of identifiersIn(descriptor)) {
          expect(key).toMatch(/^[A-Za-z_][A-Za-z0-9_]*$/);
        }
      }
    });

    it("carried no statement in any request it made", () => {
      const offending = descriptors()
        .map((descriptor) => JSON.stringify(descriptor))
        .filter((text) => STATEMENTS.some((statement) => statement.test(text)));

      expect(offending).toEqual([]);
    });

    it("would notice one, which is the only reason the assertions above are worth anything", () => {
      const smuggled = {
        kind: "listRecords",
        resourceKey: "users",
        query: {},
        sql: "select * from users",
      };

      // The scan catches it —
      expect(STATEMENTS.some((statement) => statement.test(JSON.stringify(smuggled)))).toBe(true);
      // — and it could never have been sent, because the union has no such member.
      expect(descriptorSchema.safeParse(smuggled).success).toBe(false);
      expect(
        cloudFrameSchema.safeParse({ frame: "execute", id: 1, definitionVersion: 1, descriptor: smuggled })
          .success,
      ).toBe(false);
    });
  });
});

/** Every identifier a descriptor addresses with: the keys, and never a value. */
function identifiersIn(descriptor: Descriptor): string[] {
  const keys = [descriptor.resourceKey];
  if (descriptor.kind === "listRelated") keys.push(descriptor.relationshipKey);
  if (descriptor.kind === "runAction") keys.push(descriptor.actionKey);
  return keys;
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

/** Fails rather than waits: a hop that hangs is the failure being tested for. */
async function withinMs<T>(work: Promise<T>, budget: number): Promise<T> {
  let deadline: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => reject(new Error(`still waiting after ${budget}ms`)), budget);
      }),
    ]);
  } finally {
    clearTimeout(deadline);
  }
}

/** Long enough for a socket event to have been delivered on both ends. */
function settled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 150));
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
}

function closed(server: Server | undefined): Promise<void> {
  if (!server) return Promise.resolve();
  server.closeAllConnections();
  return new Promise((resolve) => server.close(() => resolve()));
}

function portOf(server: Server): number {
  const address = server.address();
  if (typeof address !== "object" || address === null) throw new Error("the server is not listening");
  return address.port;
}

/** Opens a channel and resolves when it is up, or rejects with how it was refused. */
function handshake(url: string, token: string, contracts: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url, {
      headers: { authorization: `Bearer ${token}`, "x-repanel-contracts-version": contracts },
    });
    socket.on("error", () => undefined);
    socket.on("unexpected-response", (_request, response) =>
      reject(new Error(`refused with HTTP ${response.statusCode ?? 0}`)),
    );
    socket.on("open", () => {
      socket.close();
      resolve();
    });
  });
}

/** What Cloud wrote in the body of a refusal, which a connector reads and prints. */
function bodyOfRefusal(port: number, token: string, contracts: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(
      {
        host: "127.0.0.1",
        port,
        path: "/connector",
        headers: {
          authorization: `Bearer ${token}`,
          "x-repanel-contracts-version": contracts,
          connection: "Upgrade",
          upgrade: "websocket",
          "sec-websocket-key": Buffer.from("0123456789abcdef").toString("base64"),
          "sec-websocket-version": "13",
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
      },
    );
    request.on("error", reject);
    request.end();
  });
}
