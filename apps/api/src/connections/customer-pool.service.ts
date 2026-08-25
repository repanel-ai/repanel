import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { CustomerPool } from "@repanel/engine";
import type { Pool } from "pg";
import { CryptoService } from "../crypto/crypto.service";
import { NotFoundError } from "../errors/domain-errors";
import { ConnectionsRepository, NO_CONNECTION } from "./connections.repository";

/**
 * The engine's pool of customer connections, given the one thing it does not
 * know: where a project's database is. Finding that out is this feature's job —
 * a row it owns, decrypted — and it is done on demand, so the pool asks again
 * every time it has to open one and the DSN is held nowhere.
 */
@Injectable()
export class CustomerPoolService implements OnModuleDestroy {
  private readonly logger = new Logger(CustomerPoolService.name);
  private readonly pools: CustomerPool;

  constructor(
    private readonly repository: ConnectionsRepository,
    private readonly crypto: CryptoService,
  ) {
    this.pools = new CustomerPool({
      resolveDsn: async (projectId) => {
        const connection = await this.repository.findByProjectId(projectId);
        if (!connection) throw new NotFoundError(NO_CONNECTION);
        return this.crypto.decrypt(connection.encryptedDsn);
      },
      // The project is named; the connection it belongs to is not.
      onError: (projectId, message) =>
        this.logger.warn(`Pooled connection for project ${projectId} failed: ${message}`),
    });
  }

  poolFor(projectId: string): Promise<Pool> {
    return this.pools.poolFor(projectId);
  }

  /** Lets go of a project's pool, so the next caller opens one on whatever DSN
   *  has replaced it. Clients still working are waited for, never cut off. */
  release(projectId: string): Promise<void> {
    return this.pools.release(projectId);
  }

  /** Nothing outlives the process: every customer database gets its clients back. */
  onModuleDestroy(): Promise<void> {
    return this.pools.close();
  }
}
