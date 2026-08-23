import { Injectable } from "@nestjs/common";
import type { ConnectionDto, ConnectionTestDto, SetConnectionRequest } from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import { CryptoService } from "../crypto/crypto.service";
import { NotFoundError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { ConnectionProbeService } from "./connection-probe.service";
import { toConnectionDto } from "./connections.mapper";
import { ConnectionsRepository, NO_CONNECTION, type ConnectionRow } from "./connections.repository";
import { CustomerPoolService } from "./customer-pool.service";

/**
 * Owns the one database a project points at. The DSN passes through here twice
 * — inward to be encrypted, outward to be tested — and leaves in neither
 * direction: a caller is told what its connection reaches, never how to reach it.
 */
@Injectable()
export class ConnectionsService {
  constructor(
    private readonly repository: ConnectionsRepository,
    private readonly projects: ProjectsService,
    private readonly crypto: CryptoService,
    private readonly probe: ConnectionProbeService,
    private readonly pools: CustomerPoolService,
  ) {}

  /** Points a project at a database, replacing whatever it pointed at before. */
  async set(
    ownerId: string,
    projectId: string,
    { dsn }: SetConnectionRequest,
  ): Promise<ConnectionDto> {
    await this.projects.requireOwned(projectId, ownerId);

    const saved = await this.repository.save({
      projectId,
      encryptedDsn: this.crypto.encrypt(dsn),
    });
    // The pool the replaced DSN opened must not outlive the DSN itself.
    await this.pools.release(projectId);

    return toConnectionDto(saved, dsn);
  }

  /**
   * What this project's connection reaches, or null while it reaches nothing.
   * The DSN is decrypted only to be taken apart: what leaves is the host and
   * the database name, which is what a human needs to recognize it by.
   */
  async get(ownerId: string, projectId: string): Promise<ConnectionDto | null> {
    await this.projects.requireOwned(projectId, ownerId);

    const connection = await this.repository.findByProjectId(projectId);
    if (!connection) return null;

    return toConnectionDto(connection, this.crypto.decrypt(connection.encryptedDsn));
  }

  /** Whether the stored connection actually works, answered in categories. */
  async test(ownerId: string, projectId: string): Promise<ConnectionTestDto> {
    await this.projects.requireOwned(projectId, ownerId);
    const connection = await this.requireConnection(projectId);

    return this.probe.check(this.crypto.decrypt(connection.encryptedDsn));
  }

  /**
   * Whether a project has a connection at all. It is what an authoring agent
   * needs in order to know whether it can inspect anything, and it is all such
   * a caller is told — where the database is is a human's business.
   */
  async hasConnection(principal: Principal, projectId: string): Promise<boolean> {
    await this.projects.requireAccess(principal, projectId);

    return (await this.repository.findByProjectId(projectId)) !== undefined;
  }

  private async requireConnection(projectId: string): Promise<ConnectionRow> {
    const connection = await this.repository.findByProjectId(projectId);
    if (!connection) throw new NotFoundError(NO_CONNECTION);
    return connection;
  }
}
