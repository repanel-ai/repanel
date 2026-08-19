import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { CryptoService } from "../crypto/crypto.service";
import { NotFoundError } from "../errors/domain-errors";
import { ConnectionsRepository, NO_CONNECTION } from "./connections.repository";

/** Enough for an admin panel, and few enough to be a good guest in someone
 *  else's database — the connection budget there is not ours to spend. */
const MAX_CLIENTS = 5;

/** How long an unused client is held before the customer's database gets it back. */
const IDLE_TIMEOUT_MS = 30_000;

/** Every session this pool hands out is bounded by it, so a runaway query is
 *  the database's problem for five seconds rather than ours for an afternoon. */
const STATEMENT_TIMEOUT_MS = 5_000;

/**
 * Every connection the API keeps open into a customer's database: one pool per
 * project, opened the first time something asks and closed when the connection
 * behind it changes or the process stops. Nothing here decides who may ask —
 * a caller has been authorized long before it gets this far.
 */
@Injectable()
export class CustomerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(CustomerPoolService.name);
  private readonly pools = new Map<string, Pool>();

  /**
   * How many times each project's connection has been let go of. A pool is
   * filed only under the generation its DSN was read in, which is what makes
   * "the pool never outlives its DSN" true even for a replacement that lands
   * while a pool is being opened — the moment `release` cannot see.
   */
  private readonly generations = new Map<string, number>();

  constructor(
    private readonly repository: ConnectionsRepository,
    private readonly crypto: CryptoService,
  ) {}

  async poolFor(projectId: string): Promise<Pool> {
    // Each turn is driven by an actual replacement of this project's DSN, so
    // the loop ends as soon as the writing stops. Giving up after a few turns
    // would mean refusing a connection that is perfectly good.
    for (;;) {
      const open = this.pools.get(projectId);
      if (open) return open;

      const generation = this.generations.get(projectId) ?? 0;
      const connection = await this.repository.findByProjectId(projectId);
      if (!connection) throw new NotFoundError(NO_CONNECTION);

      // Another caller may have opened one while this one was reading, and
      // theirs wins: nothing interleaves between here and the `set` below, so a
      // project never ends up holding a second pool that nobody will ever close.
      const raced = this.pools.get(projectId);
      if (raced) return raced;

      // The connection was replaced while this read was in flight, so what came
      // back names a database this project no longer points at. Read it again.
      if ((this.generations.get(projectId) ?? 0) !== generation) continue;

      const pool = new Pool({
        connectionString: this.crypto.decrypt(connection.encryptedDsn),
        max: MAX_CLIENTS,
        idleTimeoutMillis: IDLE_TIMEOUT_MS,
        statement_timeout: STATEMENT_TIMEOUT_MS,
      });
      // An idle client that dies takes the whole process with it if nothing is
      // listening. The project is named; the connection it belongs to is not.
      pool.on("error", (error) =>
        this.logger.warn(`Pooled connection for project ${projectId} failed: ${error.message}`),
      );

      this.pools.set(projectId, pool);
      return pool;
    }
  }

  /** Lets go of a project's pool, so the next caller opens one on whatever DSN
   *  has replaced it. Clients still working are waited for, never cut off. */
  async release(projectId: string): Promise<void> {
    // Moved even when there is no pool to close: a caller may be part-way
    // through opening one on the DSN being replaced, and an empty map is
    // exactly what that looks like from here.
    this.generations.set(projectId, (this.generations.get(projectId) ?? 0) + 1);

    const pool = this.pools.get(projectId);
    if (!pool) return;

    this.pools.delete(projectId);
    await pool.end();
  }

  /** Nothing outlives the process: every customer database gets its clients back. */
  async onModuleDestroy(): Promise<void> {
    await Promise.all([...this.pools.keys()].map((projectId) => this.release(projectId)));
  }
}
