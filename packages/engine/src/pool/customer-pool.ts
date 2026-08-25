import { Pool } from "pg";

/** Enough for an admin panel, and few enough to be a good guest in someone
 *  else's database — the connection budget there is not ours to spend. */
const MAX_CLIENTS = 5;

/** How long an unused client is held before the customer's database gets it back. */
const IDLE_TIMEOUT_MS = 30_000;

/** Every session this pool hands out is bounded by it, so a runaway query is
 *  the database's problem for five seconds rather than ours for an afternoon. */
const STATEMENT_TIMEOUT_MS = 5_000;

/** What the pool is given, because it looks nothing up for itself. */
export interface CustomerPoolOptions {
  /**
   * Where the database behind a key is. Asked for every time a pool has to be
   * opened and never held onto, so the answer that replaces it is the one the
   * next pool is opened on.
   */
  resolveDsn: (key: string) => Promise<string>;
  /**
   * An idle client died. The key is named; what it connects to is not, and a
   * host that logs anything else is logging a customer's credentials.
   */
  onError?: (key: string, message: string) => void;
}

/**
 * Every connection held open into a customer's database: one pool per key,
 * opened the first time something asks and closed when the connection behind it
 * changes or the host stops. Nothing here decides who may ask — a caller has
 * been authorized long before it gets this far — and nothing here reads a
 * database, a secret store or an environment to find out where to connect.
 */
export class CustomerPool {
  private readonly pools = new Map<string, Pool>();

  /**
   * How many times each key's connection has been let go of. A pool is filed
   * only under the generation its DSN was read in, which is what makes "the
   * pool never outlives its DSN" true even for a replacement that lands while a
   * pool is being opened — the moment `release` cannot see.
   */
  private readonly generations = new Map<string, number>();

  constructor(private readonly options: CustomerPoolOptions) {}

  async poolFor(key: string): Promise<Pool> {
    // Each turn is driven by an actual replacement of this key's DSN, so the
    // loop ends as soon as the writing stops. Giving up after a few turns would
    // mean refusing a connection that is perfectly good.
    for (;;) {
      const open = this.pools.get(key);
      if (open) return open;

      const generation = this.generations.get(key) ?? 0;
      const dsn = await this.options.resolveDsn(key);

      // Another caller may have opened one while this one was reading, and
      // theirs wins: nothing interleaves between here and the `set` below, so a
      // key never ends up holding a second pool that nobody will ever close.
      const raced = this.pools.get(key);
      if (raced) return raced;

      // The connection was replaced while this read was in flight, so what came
      // back names a database this key no longer points at. Read it again.
      if ((this.generations.get(key) ?? 0) !== generation) continue;

      const pool = new Pool({
        connectionString: dsn,
        max: MAX_CLIENTS,
        idleTimeoutMillis: IDLE_TIMEOUT_MS,
        statement_timeout: STATEMENT_TIMEOUT_MS,
      });
      // An idle client that dies takes the whole process with it if nothing is
      // listening.
      pool.on("error", (error) => this.options.onError?.(key, error.message));

      this.pools.set(key, pool);
      return pool;
    }
  }

  /** Lets go of a key's pool, so the next caller opens one on whatever DSN
   *  has replaced it. Clients still working are waited for, never cut off. */
  async release(key: string): Promise<void> {
    // Moved even when there is no pool to close: a caller may be part-way
    // through opening one on the DSN being replaced, and an empty map is
    // exactly what that looks like from here.
    this.generations.set(key, (this.generations.get(key) ?? 0) + 1);

    const pool = this.pools.get(key);
    if (!pool) return;

    this.pools.delete(key);
    await pool.end();
  }

  /**
   * Nothing outlives the host: every customer database gets its clients back.
   * Called explicitly, because a package that knows nothing of a framework
   * cannot be told by one that the process is going away.
   */
  async close(): Promise<void> {
    await Promise.all([...this.pools.keys()].map((key) => this.release(key)));
  }
}
