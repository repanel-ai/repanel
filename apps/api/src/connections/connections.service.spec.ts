import { Test } from "@nestjs/testing";
import type { ConnectionTestDto, ProjectDto } from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import type { ConfigService } from "../config/config.service";
import { CryptoService } from "../crypto/crypto.service";
import { NotFoundError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { ConnectionProbeService } from "./connection-probe.service";
import {
  ConnectionsRepository,
  type ConnectionRow,
  type NewConnectionRow,
} from "./connections.repository";
import { ConnectionsService } from "./connections.service";
import { CustomerPoolService } from "./customer-pool.service";

const ADA = "user-ada";
const GRACE = "user-grace";
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
      kind: "postgres",
      encryptedDsn: connection.encryptedDsn,
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

/** Stands in for the projects feature: Crewbase is Ada's, and nothing else exists. */
class OwnedProjects implements Pick<ProjectsService, "requireOwned" | "requireAccess"> {
  requireOwned(projectId: string, ownerId: string): Promise<ProjectDto> {
    if (projectId !== CREWBASE || ownerId !== ADA) {
      return Promise.reject(new NotFoundError("Project not found"));
    }
    return Promise.resolve(PROJECT);
  }

  requireAccess(principal: Principal, projectId: string): Promise<ProjectDto> {
    if (principal.kind === "user") return this.requireOwned(projectId, principal.userId);
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
  let connections: ConnectionsService;

  beforeEach(async () => {
    repository = new InMemoryConnectionsRepository();
    probe = new ScriptedProbe();
    pools = new RecordingPools();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ConnectionsService,
        { provide: ConnectionsRepository, useValue: repository },
        { provide: ProjectsService, useValue: new OwnedProjects() },
        { provide: CryptoService, useValue: crypto },
        { provide: ConnectionProbeService, useValue: probe },
        { provide: CustomerPoolService, useValue: pools },
      ],
    }).compile();

    connections = moduleRef.get(ConnectionsService);
  });

  describe("set", () => {
    it("describes the database the project now points at", async () => {
      await expect(connections.set(ADA, CREWBASE, { dsn: DSN })).resolves.toEqual({
        kind: "postgres",
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
      expect(replaced.host).toBe("replica.example.com");
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

      expect(connection).toEqual({ kind: "postgres", host: "db.example.com", database: "crewbase" });
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
