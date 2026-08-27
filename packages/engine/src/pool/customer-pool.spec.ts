import { NotFoundError } from "../errors.js";
import { CustomerPool } from "./customer-pool.js";

const CREWBASE = "8c9a3f70-cf4a-48e5-9b85-b3b869c11a11";
const LEDGER = "1d4e5f60-7a8b-49c0-b1d2-e3f4a5b60718";

const DSN = "postgres://admin:hunter2@db.example.com:5432/crewbase";
const REPLACEMENT = "postgres://admin:hunter3@replica.example.com:5432/crewbase";

/**
 * Stands in for whoever knows where a key's database is — a table and a
 * decryption in the API, a map here. The pool is handed this and looks nothing
 * up for itself, which is the whole of what the seam is for.
 */
class DsnSource {
  private readonly dsns = new Map<string, string>();
  private parked: Promise<void> | undefined;
  private answer: (() => void) | undefined;

  file(key: string, dsn: string): void {
    this.dsns.set(key, dsn);
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

  /** Bound, because the pool is given this function and not this object. */
  readonly resolve = async (key: string): Promise<string> => {
    // The answer as it stands when the read is made, not as it stands when the
    // read returns. A database hands back what it was asked for, and an answer
    // that has gone stale in flight is the whole of what is under test.
    const dsn = this.dsns.get(key);

    const parked = this.parked;
    if (parked) {
      this.parked = undefined;
      await parked;
    }

    // What the API's own resolver does for a project pointing at nothing.
    if (dsn === undefined) throw new NotFoundError("This project has no database connection");
    return dsn;
  };
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

describe("CustomerPool", () => {
  let dsns: DsnSource;
  let pools: CustomerPool;

  beforeEach(() => {
    dsns = new DsnSource();
    dsns.file(CREWBASE, DSN);
    pools = new CustomerPool({ resolveDsn: dsns.resolve });
  });

  afterEach(async () => {
    await pools.close();
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
    });

    /**
     * A DSN may point at a transaction-mode pooler, which refuses a connection
     * that asks for a session parameter in its startup packet — and would in
     * any case hand the session on to somebody else between two of our
     * statements. The limit belongs to the statement's transaction, and this is
     * what says it is not here (DECISIONS #063, `bounded-statement.ts`).
     */
    it("asks the session for nothing at all", async () => {
      const pool = await pools.poolFor(CREWBASE);

      expect(pool.options.statement_timeout).toBeUndefined();
      expect(pool.options.options).toBeUndefined();
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
      dsns.file(LEDGER, REPLACEMENT);

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
      dsns.file(CREWBASE, REPLACEMENT);

      await pools.release(CREWBASE);
      const fresh = await pools.poolFor(CREWBASE);

      expect(fresh).not.toBe(stale);
      expect(fresh.options.connectionString).toBe(REPLACEMENT);
    });

    it("has nothing to do when the project never opened one", async () => {
      await expect(pools.release(LEDGER)).resolves.toBeUndefined();
    });

    it("invalidates an open that is still reading the connection it replaced", async () => {
      dsns.parkNextRead();
      const opening = pools.poolFor(CREWBASE);

      // The replacement lands in the one moment `release` cannot see it: no
      // pool is filed yet, so there is nothing for it to close.
      dsns.file(CREWBASE, REPLACEMENT);
      await pools.release(CREWBASE);
      dsns.answerParkedRead();

      const pool = await opening;

      expect(pool.options.connectionString).toBe(REPLACEMENT);
      // Reading again left one pool behind, not two.
      expect(await pools.poolFor(CREWBASE)).toBe(pool);
    });
  });

  describe("close", () => {
    it("gives every customer database its clients back", async () => {
      dsns.file(LEDGER, REPLACEMENT);
      const crewbase = await pools.poolFor(CREWBASE);
      const ledger = await pools.poolFor(LEDGER);

      await pools.close();

      expect(crewbase.ended).toBe(true);
      expect(ledger.ended).toBe(true);
      // Nothing closed is left behind to be handed out again.
      expect(await pools.poolFor(CREWBASE)).not.toBe(crewbase);
    });
  });
});
