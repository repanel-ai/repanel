import type { ConfigService } from "../config/config.service";
import { CryptoService } from "../crypto/crypto.service";
import { NotFoundError } from "../errors/domain-errors";
import { ConnectionsRepository, type ConnectionRow } from "./connections.repository";
import { CustomerPoolService } from "./customer-pool.service";

const CREWBASE = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const LEDGER = "1d4e5f60-7a8b-49c0-b1d2-e3f4a5b60718";

const DSN = "postgres://admin:hunter2@db.example.com:5432/crewbase";
const REPLACEMENT = "postgres://admin:hunter3@replica.example.com:5432/crewbase";

const crypto = new CryptoService({
  appEncryptionKey: Buffer.alloc(32, 3).toString("base64"),
} as unknown as ConfigService);

/** Stands in for Postgres: whatever connection has been filed for a project. */
class InMemoryConnectionsRepository implements Pick<ConnectionsRepository, "findByProjectId"> {
  private readonly rows = new Map<string, ConnectionRow>();
  private parked: Promise<void> | undefined;
  private answer: (() => void) | undefined;

  file(projectId: string, dsn: string): void {
    this.rows.set(projectId, {
      id: `connection-${projectId}`,
      projectId,
      kind: "postgres",
      encryptedDsn: crypto.encrypt(dsn),
      createdAt: new Date("2026-08-19T09:00:00.000Z"),
      updatedAt: new Date("2026-08-19T09:00:00.000Z"),
    });
  }

  /** Holds the next read open, so a test can decide what happens during it. */
  parkNextRead(): void {
    this.parked = new Promise((resolve) => {
      this.answer = resolve;
    });
  }

  answerParkedRead(): void {
    this.answer?.();
  }

  async findByProjectId(projectId: string): Promise<ConnectionRow | undefined> {
    // The row as it stands when the read is made, not as it stands when the
    // read answers. A database hands back what it was asked for, and an answer
    // that has gone stale in flight is the whole of what is under test.
    const row = this.rows.get(projectId);

    const parked = this.parked;
    if (!parked) return row;
    this.parked = undefined;
    await parked;

    return row;
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

describe("CustomerPoolService", () => {
  let repository: InMemoryConnectionsRepository;
  let pools: CustomerPoolService;

  beforeEach(() => {
    repository = new InMemoryConnectionsRepository();
    repository.file(CREWBASE, DSN);
    pools = new CustomerPoolService(repository as unknown as ConnectionsRepository, crypto);
  });

  afterEach(async () => {
    await pools.onModuleDestroy();
  });

  describe("poolFor", () => {
    it("opens the pool on the connection string it decrypts", async () => {
      const pool = await pools.poolFor(CREWBASE);

      expect(pool.options.connectionString).toBe(DSN);
    });

    it("opens it as a guest in someone else's database", async () => {
      const pool = await pools.poolFor(CREWBASE);

      expect(pool.options.max).toBe(5);
      expect(pool.options.idleTimeoutMillis).toBe(30_000);
      // Every session it hands out is bounded, so no query outlives the panel.
      expect(pool.options.statement_timeout).toBe(5_000);
    });

    it("hands the same pool back rather than opening a second one", async () => {
      const first = await pools.poolFor(CREWBASE);
      const second = await pools.poolFor(CREWBASE);

      expect(second).toBe(first);
    });

    it("opens one pool when two callers ask at once", async () => {
      const [first, second] = await Promise.all([
        pools.poolFor(CREWBASE),
        pools.poolFor(CREWBASE),
      ]);

      expect(second).toBe(first);
    });

    it("keeps one project's pool apart from another's", async () => {
      repository.file(LEDGER, REPLACEMENT);

      expect(await pools.poolFor(LEDGER)).not.toBe(await pools.poolFor(CREWBASE));
    });

    it("refuses a project that points at no database", async () => {
      const refusal = await refusalFrom(pools.poolFor(LEDGER));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(refusal.message).toBe("This project has no database connection");
    });
  });

  describe("release", () => {
    it("closes the pool it lets go of", async () => {
      const pool = await pools.poolFor(CREWBASE);

      await pools.release(CREWBASE);

      expect(pool.ended).toBe(true);
    });

    it("opens the next pool on the connection that replaced the old one", async () => {
      const stale = await pools.poolFor(CREWBASE);
      repository.file(CREWBASE, REPLACEMENT);

      await pools.release(CREWBASE);
      const fresh = await pools.poolFor(CREWBASE);

      expect(fresh).not.toBe(stale);
      expect(fresh.options.connectionString).toBe(REPLACEMENT);
    });

    it("has nothing to do when the project never opened one", async () => {
      await expect(pools.release(LEDGER)).resolves.toBeUndefined();
    });

    it("invalidates an open that is still reading the connection it replaced", async () => {
      repository.parkNextRead();
      const opening = pools.poolFor(CREWBASE);

      // The replacement lands in the one moment `release` cannot see it: no
      // pool is filed yet, so there is nothing for it to close.
      repository.file(CREWBASE, REPLACEMENT);
      await pools.release(CREWBASE);
      repository.answerParkedRead();

      const pool = await opening;

      expect(pool.options.connectionString).toBe(REPLACEMENT);
      // Reading again left one pool behind, not two.
      expect(await pools.poolFor(CREWBASE)).toBe(pool);
    });
  });

  describe("onModuleDestroy", () => {
    it("gives every customer database its clients back", async () => {
      repository.file(LEDGER, REPLACEMENT);
      const crewbase = await pools.poolFor(CREWBASE);
      const ledger = await pools.poolFor(LEDGER);

      await pools.onModuleDestroy();

      expect(crewbase.ended).toBe(true);
      expect(ledger.ended).toBe(true);
      // Nothing closed is left behind to be handed out again.
      expect(await pools.poolFor(CREWBASE)).not.toBe(crewbase);
    });
  });
});
