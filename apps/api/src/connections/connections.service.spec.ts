import { Test } from "@nestjs/testing";
import type {
  ConnectionDto,
  ConnectionTestDto,
  DirectConnectionDto,
  ProjectDto,
  ProjectRole,
} from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import type { ConfigService } from "../config/config.service";
import { CryptoService } from "../crypto/crypto.service";
import { ForbiddenError, NotFoundError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { ConnectionProbeService } from "./connection-probe.service";
import {
  ConnectionsRepository,
  type ConnectionRow,
  type NewConnectionRow,
} from "./connections.repository";
import { ConnectionsService } from "./connections.service";
import { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import {
  ConnectorTokensRepository,
  type ConnectorTokenRow,
} from "../connector-sockets/connector-tokens.repository";
import { CONNECTOR_TOKEN_PATTERN } from "../connector-sockets/connector-token";
import { CustomerPoolService } from "./customer-pool.service";

const ADA = "user-ada";
const GRACE = "user-grace";
/** On Crewbase, but only to use its admin. */
const RAVI = "user-ravi";
const CREWBASE = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const LEDGER = "1d4e5f60-7a8b-49c0-b1d2-e3f4a5b60718";

const PROJECT: ProjectDto = {
  id: CREWBASE,
  name: "Crewbase",
  key: "crewbase-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

const DSN = "postgres://admin:hunter2@db.example.com:5432/crewbase";
const REPLACEMENT = "postgres://reader:s3cret@replica.example.com:5432/crewbase";

const crypto = new CryptoService({
  appEncryptionKey: Buffer.alloc(32, 5).toString("base64"),
} as unknown as ConfigService);

/** Stands in for Postgres: one connection per project, replaced rather than added to. */
class InMemoryConnectionsRepository
  implements Pick<ConnectionsRepository, "save" | "findByProjectId">
{
  readonly rows: ConnectionRow[] = [];

  save(connection: NewConnectionRow): Promise<ConnectionRow> {
    const previous = this.rows.find((row) => row.projectId === connection.projectId);
    const saved: ConnectionRow = {
      id: previous?.id ?? `connection-${this.rows.length + 1}`,
      projectId: connection.projectId,
      kind: connection.kind ?? "postgres-direct",
      encryptedDsn: connection.encryptedDsn ?? null,
      createdAt: previous?.createdAt ?? new Date("2026-08-19T09:00:00.000Z"),
      updatedAt: new Date("2026-08-19T11:00:00.000Z"),
    };

    if (previous) this.rows.splice(this.rows.indexOf(previous), 1, saved);
    else this.rows.push(saved);
    return Promise.resolve(saved);
  }

  findByProjectId(projectId: string): Promise<ConnectionRow | undefined> {
    return Promise.resolve(this.rows.find((row) => row.projectId === projectId));
  }
}

/**
 * Stands in for the projects feature: Crewbase is Ada's, Ravi operates it, and
 * nothing else exists.
 */
class MemberProjects implements Pick<ProjectsService, "requireMember" | "requireAccess"> {
  requireMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectDto> {
    if (projectId !== CREWBASE) return Promise.reject(new NotFoundError("Project not found"));
    if (userId === ADA) return Promise.resolve(PROJECT);
    if (userId !== RAVI) return Promise.reject(new NotFoundError("Project not found"));

    return role === "operator"
      ? Promise.resolve(PROJECT)
      : Promise.reject(new ForbiddenError("Only this project's owner can do that"));
  }

  requireAccess(principal: Principal, projectId: string, role: ProjectRole): Promise<ProjectDto> {
    if (principal.kind === "user") return this.requireMember(projectId, principal.userId, role);
    if (principal.projectId !== projectId || projectId !== CREWBASE) {
      return Promise.reject(new NotFoundError("Project not found"));
    }
    return Promise.resolve(PROJECT);
  }
}

/** Stands in for the database at the other end, with whatever answer a test needs. */
class ScriptedProbe implements Pick<ConnectionProbeService, "check"> {
  readonly asked: string[] = [];
  verdict: ConnectionTestDto = { ok: true };

  check(dsn: string): Promise<ConnectionTestDto> {
    this.asked.push(dsn);
    return Promise.resolve(this.verdict);
  }
}

/** Stands in for the pool cache, and remembers what it was told to let go of. */
class RecordingPools implements Pick<CustomerPoolService, "release"> {
  readonly released: string[] = [];

  release(projectId: string): Promise<void> {
    this.released.push(projectId);
    return Promise.resolve();
  }
}

/** Stands in for the connector token table: one row per project, replaced. */
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
      createdAt: new Date("2026-08-27T09:00:00.000Z"),
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

/** Stands in for the socket transport, and remembers who it was told to turn away. */
class RecordingSockets implements Pick<ConnectorSocketsService, "revoke" | "lastSeenAt"> {
  readonly revoked: string[] = [];
  live?: Date;

  revoke(projectId: string): void {
    this.revoked.push(projectId);
  }

  lastSeenAt(): Date | undefined {
    return this.live;
  }
}

/** The direct connection an answer describes; fails the test if it is not one. */
function directOf(connection: ConnectionDto | null): DirectConnectionDto {
  if (connection?.kind !== "postgres-direct") {
    throw new Error(`expected a direct connection, got ${connection?.kind ?? "nothing"}`);
  }
  return connection;
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

describe("ConnectionsService", () => {
  let repository: InMemoryConnectionsRepository;
  let probe: ScriptedProbe;
  let pools: RecordingPools;
  let tokens: InMemoryConnectorTokens;
  let sockets: RecordingSockets;
  let connections: ConnectionsService;

  beforeEach(async () => {
    repository = new InMemoryConnectionsRepository();
    probe = new ScriptedProbe();
    pools = new RecordingPools();
    tokens = new InMemoryConnectorTokens();
    sockets = new RecordingSockets();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: ConnectionsRepository, useValue: repository },
        { provide: ProjectsService, useValue: new MemberProjects() },
        { provide: CryptoService, useValue: crypto },
        { provide: ConnectionProbeService, useValue: probe },
        { provide: CustomerPoolService, useValue: pools },
        { provide: ConnectorTokensRepository, useValue: tokens },
        { provide: ConnectorSocketsService, useValue: sockets },
      ],
    }).compile();

    connections = moduleRef.get(ConnectionsService);
  });

  describe("set", () => {
    it("describes the database the project now points at", async () => {
      await expect(connections.set(ADA, CREWBASE, { dsn: DSN })).resolves.toEqual({
        kind: "postgres-direct",
        host: "db.example.com",
        database: "crewbase",
      });
    });

    it("stores the connection string encrypted, and readable only with the key", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });
      const [stored] = repository.rows;

      expect(stored?.encryptedDsn).not.toContain("hunter2");
      expect(stored?.encryptedDsn).not.toContain("db.example.com");
      expect(crypto.decrypt(stored?.encryptedDsn ?? "")).toBe(DSN);
    });

    it("replaces the connection rather than adding a second one", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });
      const replaced = await connections.set(ADA, CREWBASE, { dsn: REPLACEMENT });

      expect(repository.rows).toHaveLength(1);
      expect(directOf(replaced).host).toBe("replica.example.com");
      expect(crypto.decrypt(repository.rows[0]?.encryptedDsn ?? "")).toBe(REPLACEMENT);
    });

    it("lets go of the pool the replaced connection string opened", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });

      expect(pools.released).toEqual([CREWBASE]);
    });

    it("refuses a project the caller does not own, and files nothing", async () => {
      const refusal = await refusalFrom(connections.set(GRACE, CREWBASE, { dsn: DSN }));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
      expect(pools.released).toEqual([]);
    });
  });

  describe("get", () => {
    it("answers with nothing while the project points at no database", async () => {
      await expect(connections.get(ADA, CREWBASE)).resolves.toBeNull();
    });

    it("describes the database the project points at, without the credential", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });

      const connection = await connections.get(ADA, CREWBASE);

      expect(connection).toEqual({
        kind: "postgres-direct",
        host: "db.example.com",
        database: "crewbase",
      });
      expect(JSON.stringify(connection)).not.toContain("hunter2");
    });

    it("refuses a project the caller does not own", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });

      const refusal = await refusalFrom(connections.get(GRACE, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("test", () => {
    beforeEach(async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });
    });

    it("asks the database itself, with the connection string as it was given", async () => {
      await connections.test(ADA, CREWBASE);

      expect(probe.asked).toEqual([DSN]);
    });

    it("passes a working connection through as it stands", async () => {
      await expect(connections.test(ADA, CREWBASE)).resolves.toEqual({ ok: true });
    });

    it("passes every kind of failure through as a category", async () => {
      for (const reason of ["unreachable", "auth_failed", "timeout", "unknown"] as const) {
        probe.verdict = { ok: false, reason };

        await expect(connections.test(ADA, CREWBASE)).resolves.toEqual({ ok: false, reason });
      }
    });

    it("refuses a project that points at no database", async () => {
      repository.rows.length = 0;

      const refusal = await refusalFrom(connections.test(ADA, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(probe.asked).toEqual([]);
    });

    it("refuses a project the caller does not own, and connects to nothing", async () => {
      const refusal = await refusalFrom(connections.test(GRACE, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(probe.asked).toEqual([]);
    });
  });

  describe("useConnector", () => {
    it("mints a token, and hands it over exactly once", async () => {
      const minted = await connections.useConnector(ADA, CREWBASE);

      expect(minted.token).toMatch(CONNECTOR_TOKEN_PATTERN);
      // Only a digest is kept, so this response is the only copy there will be.
      expect(JSON.stringify(tokens.rows)).not.toContain(minted.token);
    });

    it("puts the project on the connector rung, holding no connection string at all", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });

      await connections.useConnector(ADA, CREWBASE);

      expect(repository.rows).toHaveLength(1);
      expect(repository.rows[0]).toMatchObject({ kind: "connector", encryptedDsn: null });
    });

    it("lets go of the pool the connection string it replaced had opened", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });
      pools.released.length = 0;

      await connections.useConnector(ADA, CREWBASE);

      expect(pools.released).toEqual([CREWBASE]);
    });

    it("minting again replaces the token, and turns away the connector using it", async () => {
      const first = await connections.useConnector(ADA, CREWBASE);
      const second = await connections.useConnector(ADA, CREWBASE);

      expect(second.token).not.toBe(first.token);
      expect(tokens.rows).toHaveLength(1);
      expect(sockets.revoked).toEqual([CREWBASE, CREWBASE]);
    });

    it("refuses a project the caller does not own, and mints nothing", async () => {
      const refusal = await refusalFrom(connections.useConnector(GRACE, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(tokens.rows).toEqual([]);
      expect(repository.rows).toEqual([]);
    });

    it("refuses an operator, who reaches the admin and nothing that configures it", async () => {
      const refusal = await refusalFrom(connections.useConnector(RAVI, CREWBASE));

      expect(refusal).toBeInstanceOf(ForbiddenError);
      expect(tokens.rows).toEqual([]);
    });
  });

  describe("a project on the connector rung", () => {
    beforeEach(async () => {
      await connections.useConnector(ADA, CREWBASE);
    });

    it("says whether its connector is there, and never where its database is", async () => {
      sockets.live = new Date("2026-08-27T10:15:00.000Z");

      await expect(connections.get(ADA, CREWBASE)).resolves.toEqual({
        kind: "connector",
        connected: true,
        lastSeenAt: "2026-08-27T10:15:00.000Z",
      });
    });

    it("says it is offline, and when it was last heard from, from what was filed", async () => {
      tokens.rows[0]!.lastSeenAt = new Date("2026-08-27T09:00:00.000Z");

      await expect(connections.get(ADA, CREWBASE)).resolves.toEqual({
        kind: "connector",
        connected: false,
        lastSeenAt: "2026-08-27T09:00:00.000Z",
      });
    });

    it("has no connection string to test, and says so rather than probing something", async () => {
      const refusal = await refusalFrom(connections.test(ADA, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(probe.asked).toEqual([]);
    });

    it("routes its runtime requests over the connector", async () => {
      await expect(connections.kindFor(CREWBASE)).resolves.toBe("connector");
    });

    it("goes back to a connection string, taking the connector's credential with it", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });

      expect(repository.rows[0]).toMatchObject({ kind: "postgres-direct" });
      expect(tokens.rows).toEqual([]);
      expect(sockets.revoked).toContain(CREWBASE);
      await expect(connections.kindFor(CREWBASE)).resolves.toBe("postgres-direct");
    });
  });

  describe("kindFor", () => {
    it("refuses a project that points at nothing, rather than guessing a rung", async () => {
      const refusal = await refusalFrom(connections.kindFor(CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("hasConnection", () => {
    const asUser = (userId: string): Principal => ({ kind: "user", userId });
    const asAgent = (projectId: string): Principal => ({ kind: "agent", projectId });

    it("says no before a database has been named", async () => {
      await expect(connections.hasConnection(asUser(ADA), CREWBASE)).resolves.toBe(false);
    });

    it("says yes once one has", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });

      await expect(connections.hasConnection(asUser(ADA), CREWBASE)).resolves.toBe(true);
    });

    it("answers the project's own agent, which is all it can ask after", async () => {
      await connections.set(ADA, CREWBASE, { dsn: DSN });

      await expect(connections.hasConnection(asAgent(CREWBASE), CREWBASE)).resolves.toBe(true);
    });

    it("answers an agent asking after another project as missing", async () => {
      const refusal = await refusalFrom(connections.hasConnection(asAgent(CREWBASE), LEDGER));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers a user asking after someone else's project as missing", async () => {
      const refusal = await refusalFrom(connections.hasConnection(asUser(GRACE), CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  it("never answers with the connection string, whatever it is asked", async () => {
    const answers = [
      await connections.set(ADA, CREWBASE, { dsn: DSN }),
      await connections.test(ADA, CREWBASE),
      await connections.hasConnection({ kind: "user", userId: ADA }, CREWBASE),
    ];

    const rendered = JSON.stringify(answers);
    expect(rendered).not.toContain(DSN);
    expect(rendered).not.toContain("hunter2");
    expect(rendered).not.toContain("admin");
  });
});
