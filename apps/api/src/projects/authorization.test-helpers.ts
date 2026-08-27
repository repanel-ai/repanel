import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { SESSION_COOKIE, type ConnectionKind, type UserDto } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import {
  ActionRunner,
  HttpCall,
  QueryBuilder,
  RecordReader,
  RecordWriter,
} from "@repanel/engine";
import type { Request } from "express";
import { ActionsController } from "../actions/actions.controller";
import { ActionsService } from "../actions/actions.service";
import { ActivityController } from "../activity/activity.controller";
import type { ActivityRepository } from "../activity/activity.repository";
import { ActivityService } from "../activity/activity.service";
import { AgentTokenGuard } from "../agent-tokens/agent-token.guard";
import { AgentTokensController } from "../agent-tokens/agent-tokens.controller";
import type { AgentTokensRepository, AgentTokenRow } from "../agent-tokens/agent-tokens.repository";
import { AgentTokensService } from "../agent-tokens/agent-tokens.service";
import { AuthController } from "../auth/auth.controller";
import type { AuthRepository, SessionWithUser, UserRow } from "../auth/auth.repository";
import { AuthService } from "../auth/auth.service";
import { PasswordService } from "../auth/password.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import type { ConfigService } from "../config/config.service";
import type { ConnectionProbeService } from "../connections/connection-probe.service";
import { ConnectionsController } from "../connections/connections.controller";
import type { ConnectionRow, ConnectionsRepository } from "../connections/connections.repository";
import { ConnectionsService } from "../connections/connections.service";
import type { CustomerPoolService } from "../connections/customer-pool.service";
import type { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import type {
  ConnectorTokensRepository,
  ConnectorTokenRow,
} from "../connector-sockets/connector-tokens.repository";
import { CryptoService } from "../crypto/crypto.service";
import type {
  DefinitionVersionRow,
  DefinitionVersionsRepository,
} from "../definitions/definition-versions.repository";
import { DefinitionsController } from "../definitions/definitions.controller";
import type { DefinitionRow, DefinitionsRepository } from "../definitions/definitions.repository";
import { DefinitionsService } from "../definitions/definitions.service";
import { ConnectorOfflineError } from "../errors/domain-errors";
import { HealthController } from "../health/health.controller";
import { HealthService } from "../health/health.service";
import type { DbService } from "../db/db.service";
import { McpController } from "../mcp/mcp.controller";
import type { McpService } from "../mcp/mcp.service";
import { RecordsController } from "../records/records.controller";
import { RecordsService } from "../records/records.service";
import { ExecutorsService } from "../runtime/executors.service";
import { RuntimeController } from "../runtime/runtime.controller";
import { RuntimeService } from "../runtime/runtime.service";
import { PeopleController } from "./people.controller";
import { PeopleService } from "./people.service";
import type { ProjectsRepository } from "./projects.repository";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { InMemoryProjectsRepository } from "./projects.test-helpers";

/**
 * Every controller in the API, wired to real services and fake storage, so the
 * authorization matrix can put five kinds of caller through every route.
 *
 * What is real is what the matrix is about: the guards, the services, and the
 * membership lookups they authorize with. What is faked is everything on the
 * far side of a gate — the customer's database above all, which is why a read
 * that gets past authorization ends in `NO_CUSTOMER_DATABASE` rather than rows.
 * The matrix reads that as "reached", and reaching is the whole question.
 */
export const NO_CUSTOMER_DATABASE = "the matrix has no customer database";

/** A throwaway key: nothing here is encrypted for anyone to read later. */
const CONFIG = {
  nodeEnv: "test",
  apiUrl: "http://api.test",
  consoleUrl: "http://console.test",
  runtimeUrl: "http://runtime.test",
  appEncryptionKey: Buffer.alloc(32, 7).toString("base64"),
} as unknown as ConfigService;

/** The password every account in the matrix is created with. */
export const PASSWORD = "matrix-password";

class InMemoryAuthRepository
  implements
    Pick<
      AuthRepository,
      | "findUserByEmail"
      | "findUsersByIds"
      | "createUser"
      | "createSession"
      | "findSessionByTokenHash"
      | "deleteSessionByTokenHash"
    >
{
  readonly users: UserRow[] = [];
  private readonly sessions = new Map<string, { userId: string; expiresAt: Date }>();

  findUserByEmail(email: string): Promise<UserRow | undefined> {
    return Promise.resolve(this.users.find((user) => user.email === email));
  }

  findUsersByIds(ids: string[]): Promise<UserRow[]> {
    return Promise.resolve(this.users.filter((user) => ids.includes(user.id)));
  }

  createUser(user: { email: string; name: string; passwordHash: string }): Promise<UserRow> {
    const created: UserRow = {
      id: `user-${this.users.length + 1}`,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      createdAt: new Date(),
    };
    this.users.push(created);
    return Promise.resolve(created);
  }

  createSession(session: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    this.sessions.set(session.tokenHash, {
      userId: session.userId,
      expiresAt: session.expiresAt,
    });
    return Promise.resolve();
  }

  findSessionByTokenHash(tokenHash: string): Promise<SessionWithUser | undefined> {
    const found = this.sessions.get(tokenHash);
    const user = this.users.find((candidate) => candidate.id === found?.userId);
    if (!found || !user) return Promise.resolve(undefined);

    return Promise.resolve({
      session: {
        id: `session-${tokenHash.slice(0, 8)}`,
        userId: found.userId,
        tokenHash,
        expiresAt: found.expiresAt,
        createdAt: new Date(),
      },
      user,
    });
  }

  deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }
}

class InMemoryAgentTokensRepository
  implements Pick<AgentTokensRepository, "create" | "listByProjectId" | "recordUse">
{
  readonly tokens: AgentTokenRow[] = [];

  create(token: { projectId: string; label: string; tokenHash: string }): Promise<AgentTokenRow> {
    const created: AgentTokenRow = {
      id: `token-${this.tokens.length + 1}`,
      projectId: token.projectId,
      label: token.label,
      tokenHash: token.tokenHash,
      createdAt: new Date(),
      lastUsedAt: null,
    };
    this.tokens.push(created);
    return Promise.resolve(created);
  }

  listByProjectId(projectId: string): Promise<AgentTokenRow[]> {
    return Promise.resolve(this.tokens.filter((token) => token.projectId === projectId));
  }

  recordUse(tokenHash: string): Promise<AgentTokenRow | undefined> {
    const used = this.tokens.find((token) => token.tokenHash === tokenHash);
    if (used) used.lastUsedAt = new Date();
    return Promise.resolve(used);
  }
}

class InMemoryConnectionsRepository
  implements Pick<ConnectionsRepository, "save" | "findByProjectId">
{
  readonly rows: ConnectionRow[] = [];

  save(connection: {
    projectId: string;
    kind?: ConnectionKind;
    encryptedDsn?: string | null;
  }): Promise<ConnectionRow> {
    const previous = this.rows.findIndex((row) => row.projectId === connection.projectId);
    const saved: ConnectionRow = {
      id: `connection-${this.rows.length + 1}`,
      projectId: connection.projectId,
      kind: connection.kind ?? "postgres-direct",
      encryptedDsn: connection.encryptedDsn ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (previous >= 0) this.rows.splice(previous, 1, saved);
    else this.rows.push(saved);
    return Promise.resolve(saved);
  }

  findByProjectId(projectId: string): Promise<ConnectionRow | undefined> {
    return Promise.resolve(this.rows.find((row) => row.projectId === projectId));
  }
}

/** The matrix mints connector tokens but nothing ever dials in with one. */
class InMemoryConnectorTokens
  implements
    Pick<ConnectorTokensRepository, "save" | "findByProjectId" | "deleteByProjectId" | "recordSeen">
{
  readonly rows: ConnectorTokenRow[] = [];

  save(projectId: string, tokenHash: string): Promise<ConnectorTokenRow> {
    const saved: ConnectorTokenRow = {
      id: `connector-token-${projectId}`,
      projectId,
      tokenHash,
      createdAt: new Date(),
      lastSeenAt: null,
    };
    const previous = this.rows.findIndex((row) => row.projectId === projectId);
    if (previous >= 0) this.rows.splice(previous, 1, saved);
    else this.rows.push(saved);
    return Promise.resolve(saved);
  }

  findByProjectId(projectId: string): Promise<ConnectorTokenRow | undefined> {
    return Promise.resolve(this.rows.find((row) => row.projectId === projectId));
  }

  deleteByProjectId(projectId: string): Promise<void> {
    const found = this.rows.findIndex((row) => row.projectId === projectId);
    if (found >= 0) this.rows.splice(found, 1);
    return Promise.resolve();
  }

  recordSeen(): Promise<void> {
    return Promise.resolve();
  }
}

/** No connector ever dials into the matrix, and every route says so the same way. */
class NoConnector
  implements Pick<ConnectorSocketsService, "execute" | "notify" | "revoke" | "isConnected" | "lastSeenAt">
{
  execute(): Promise<never> {
    return Promise.reject(new ConnectorOfflineError(NO_CUSTOMER_DATABASE));
  }

  notify(): void {}

  revoke(): void {}

  isConnected(): boolean {
    return false;
  }

  lastSeenAt(): Date | undefined {
    return undefined;
  }
}

class InMemoryDefinitionsRepository
  implements Pick<DefinitionsRepository, "save" | "findByProjectId">
{
  readonly drafts = new Map<string, DefinitionRow>();

  save(draft: { projectId: string; payload: unknown; valid: boolean }): Promise<DefinitionRow> {
    const saved: DefinitionRow = {
      id: `definition-${draft.projectId}`,
      projectId: draft.projectId,
      payload: draft.payload,
      valid: draft.valid,
      errors: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.drafts.set(draft.projectId, saved);
    return Promise.resolve(saved);
  }

  findByProjectId(projectId: string): Promise<DefinitionRow | undefined> {
    return Promise.resolve(this.drafts.get(projectId));
  }
}

class InMemoryVersionsRepository
  implements Pick<DefinitionVersionsRepository, "insertNext" | "findLatest">
{
  private readonly versions = new Map<string, DefinitionVersionRow>();

  insertNext(projectId: string, payload: unknown): Promise<DefinitionVersionRow> {
    const published: DefinitionVersionRow = {
      id: `version-${projectId}`,
      projectId,
      version: (this.versions.get(projectId)?.version ?? 0) + 1,
      payload,
      publishedAt: new Date(),
    };
    this.versions.set(projectId, published);
    return Promise.resolve(published);
  }

  findLatest(projectId: string): Promise<DefinitionVersionRow | undefined> {
    return Promise.resolve(this.versions.get(projectId));
  }
}

class InMemoryActivityRepository implements Pick<ActivityRepository, "insert" | "listForRecord"> {
  insert(): Promise<never> {
    return Promise.reject(new Error(NO_CUSTOMER_DATABASE));
  }

  listForRecord(): Promise<{ rows: []; total: number }> {
    return Promise.resolve({ rows: [], total: 0 });
  }
}

/** Every project here points at a database that is not there. */
class NoCustomerDatabase implements Pick<CustomerPoolService, "poolFor" | "release"> {
  poolFor(): Promise<never> {
    return Promise.reject(new Error(NO_CUSTOMER_DATABASE));
  }

  release(): Promise<void> {
    return Promise.resolve();
  }
}

/** Who is asking, and what they are carrying when they ask. */
export interface Actor {
  label: string;
  user: UserDto | null;
  cookie?: string;
  bearer?: string;
}

export interface Api {
  auth: AuthController;
  projects: ProjectsController;
  people: PeopleController;
  agentTokens: AgentTokensController;
  connections: ConnectionsController;
  definitions: DefinitionsController;
  runtime: RuntimeController;
  records: RecordsController;
  actions: ActionsController;
  activity: ActivityController;
  mcp: McpController;
  health: HealthController;
  /** The guard instances the routes are behind, by the name the metadata gives. */
  guards: Record<string, CanActivate>;
  /** Crewbase: owned by the owner, operated by the operator. */
  projectId: string;
  projectKey: string;
  /** Ledger: the outsider's own project, which nobody else is on. */
  otherProjectId: string;
  owner: Actor;
  operator: Actor;
  outsider: Actor;
  agent: Actor;
  anonymous: Actor;
  /**
   * An operator on Crewbase that exists to be revoked, one per caller the
   * matrix runs. Revoking is the only route that would otherwise change the
   * world out from under the rows after it.
   */
  disposable: Record<string, string>;
  /** Takes the operator off Crewbase, the way the People page does. */
  revokeOperator(): Promise<void>;
}

/** The whole API, standing up in memory, with three people and one agent token. */
export async function buildApi(): Promise<Api> {
  const crypto = new CryptoService(CONFIG);
  const authRepository = new InMemoryAuthRepository();
  const auth = new AuthService(
    authRepository as unknown as AuthRepository,
    new PasswordService(),
  );
  const sessions = new SessionAuthGuard(auth);

  const projectsRepository = new InMemoryProjectsRepository();
  const projects = new ProjectsService(
    projectsRepository as unknown as ProjectsRepository,
    crypto,
  );
  const people = new PeopleService(
    projects,
    projectsRepository as unknown as ProjectsRepository,
    auth,
  );

  const tokensRepository = new InMemoryAgentTokensRepository();
  const agentTokens = new AgentTokensService(
    tokensRepository as unknown as AgentTokensRepository,
    projects,
  );

  const connectionsRepository = new InMemoryConnectionsRepository();
  const connectorTokens = new InMemoryConnectorTokens();
  const connectorSockets = new NoConnector();
  const pools = new NoCustomerDatabase();
  const connections = new ConnectionsService(
    connectionsRepository as unknown as ConnectionsRepository,
    projects,
    crypto,
    { check: () => Promise.resolve({ ok: true }) } as unknown as ConnectionProbeService,
    pools as unknown as CustomerPoolService,
    connectorTokens as unknown as ConnectorTokensRepository,
    connectorSockets as unknown as ConnectorSocketsService,
  );

  const definitionsRepository = new InMemoryDefinitionsRepository();
  const versions = new InMemoryVersionsRepository();
  const definitions = new DefinitionsService(
    definitionsRepository as unknown as DefinitionsRepository,
    versions as unknown as DefinitionVersionsRepository,
    projects,
    CONFIG,
    connectorSockets as unknown as ConnectorSocketsService,
  );

  const queries = new QueryBuilder();
  const reader = new RecordReader(queries);
  // The real routing, over the real connections table: which rung a project is
  // on is read the way every request reads it, and neither rung has anything
  // behind it here.
  const executors = new ExecutorsService(
    reader,
    new RecordWriter(queries),
    new ActionRunner(reader, queries, new HttpCall()),
    connectorSockets as unknown as ConnectorSocketsService,
  );
  const runtime = new RuntimeService(
    projects,
    definitions,
    connections,
    pools as unknown as CustomerPoolService,
    executors,
  );
  const activity = new ActivityService(
    projects,
    new InMemoryActivityRepository() as unknown as ActivityRepository,
  );
  const records = new RecordsService(runtime, activity, executors);
  const actions = new ActionsService(runtime, projects, activity, executors);

  // Three people: one owns Crewbase, one operates it, one is on neither and has
  // a project of their own — which is what makes "somebody else's project" a
  // real case rather than a missing row.
  const ownerUser = await auth.createAccount({
    email: "owner@example.com",
    name: "Ada",
    password: PASSWORD,
  });
  const operatorUser = await auth.createAccount({
    email: "operator@example.com",
    name: "Ravi",
    password: PASSWORD,
  });
  const outsiderUser = await auth.createAccount({
    email: "outsider@example.com",
    name: "Grace",
    password: PASSWORD,
  });

  const crewbase = await projects.create(ownerUser.id, { name: "Crewbase" });
  const ledger = await projects.create(outsiderUser.id, { name: "Ledger" });
  await people.addOperator(ownerUser.id, crewbase.id, {
    email: operatorUser.email,
    name: operatorUser.name,
  });

  // An admin to reach: a draft to publish, and a published version to serve.
  await definitionsRepository.save({
    projectId: crewbase.id,
    payload: saasDefinition,
    valid: true,
  });
  await versions.insertNext(crewbase.id, saasDefinition);

  // One removable operator per caller, so the revoke row has something of its
  // own to remove and the rows after it still find the world they expect.
  const disposable: Record<string, string> = {};
  for (const label of ["owner", "operator", "non-member", "agent token", "unauthenticated"]) {
    const added = await people.addOperator(ownerUser.id, crewbase.id, {
      email: `disposable-${label.replace(/\s+/g, "-")}@example.com`,
      name: "Disposable",
    });
    disposable[label] = added.person.userId;
  }

  const minted = await agentTokens.mint(ownerUser.id, crewbase.id, { label: "The matrix" });
  const agentGuard = new AgentTokenGuard(agentTokens);

  return {
    auth: new AuthController(auth, CONFIG),
    projects: new ProjectsController(projects),
    people: new PeopleController(people),
    agentTokens: new AgentTokensController(agentTokens),
    connections: new ConnectionsController(connections),
    definitions: new DefinitionsController(definitions),
    runtime: new RuntimeController(runtime),
    records: new RecordsController(records),
    actions: new ActionsController(actions),
    activity: new ActivityController(activity),
    guards: { SessionAuthGuard: sessions, AgentTokenGuard: agentGuard },
    mcp: new McpController({ handle: () => Promise.resolve() } as unknown as McpService),
    health: new HealthController(
      new HealthService({ db: { execute: () => Promise.resolve() } } as unknown as DbService),
    ),
    projectId: crewbase.id,
    projectKey: crewbase.key,
    otherProjectId: ledger.id,
    owner: { label: "owner", user: ownerUser, cookie: await sessionFor(auth, ownerUser.id) },
    operator: {
      label: "operator",
      user: operatorUser,
      cookie: await sessionFor(auth, operatorUser.id),
    },
    outsider: {
      label: "non-member",
      user: outsiderUser,
      cookie: await sessionFor(auth, outsiderUser.id),
    },
    disposable,
    agent: { label: "agent token", user: null, bearer: minted.token },
    anonymous: { label: "unauthenticated", user: null },
    revokeOperator: () => people.revoke(ownerUser.id, crewbase.id, operatorUser.id),
  };
}

/** The guards a route is behind, in the order Nest would run them. */
export function guardsFor(api: Api, names: readonly string[]): CanActivate[] {
  return names.map((name) => {
    const guard = api.guards[name];
    if (!guard) throw new Error(`The matrix does not know the guard ${name}`);
    return guard;
  });
}

/** What a guard is handed: a request carrying whatever the actor carries. */
export function contextFor(actor: Actor): ExecutionContext {
  const request = {
    cookies: actor.cookie ? { [SESSION_COOKIE]: actor.cookie } : {},
    headers: actor.bearer ? { authorization: `Bearer ${actor.bearer}` } : {},
  } as unknown as Request;

  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function sessionFor(auth: AuthService, userId: string): Promise<string> {
  return auth.mintSession(userId).then((session) => session.token);
}
