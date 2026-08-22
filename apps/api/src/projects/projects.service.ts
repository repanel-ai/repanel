import { Injectable } from "@nestjs/common";
import type { ActionSecretDto, CreateProjectRequest, ProjectDto } from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import { CryptoService } from "../crypto/crypto.service";
import { ConflictError, NotFoundError } from "../errors/domain-errors";
import { createActionSecret } from "./action-secret";
import { createProjectKey } from "./project-key";
import { toProjectDto } from "./projects.mapper";
import { ProjectsRepository } from "./projects.repository";

/**
 * How many keys to draw before giving up. Two draws collide once in 36^6, so
 * a third attempt is already generosity; an unbounded loop would not be.
 */
const KEY_ATTEMPTS = 3;

@Injectable()
export class ProjectsService {
  constructor(
    private readonly repository: ProjectsRepository,
    private readonly crypto: CryptoService,
  ) {}

  async create(ownerId: string, { name }: CreateProjectRequest): Promise<ProjectDto> {
    for (let attempt = 0; attempt < KEY_ATTEMPTS; attempt += 1) {
      try {
        const key = createProjectKey(name);
        return toProjectDto(await this.repository.create({ userId: ownerId, name, key }));
      } catch (error) {
        // The key is all that can conflict, and a fresh suffix is the remedy.
        if (!(error instanceof ConflictError)) throw error;
      }
    }

    throw new ConflictError("Could not find a free project key");
  }

  async list(ownerId: string): Promise<ProjectDto[]> {
    const owned = await this.repository.listByOwner(ownerId);
    return owned.map(toProjectDto);
  }

  /**
   * The project, if it belongs to this user. Someone else's reads as missing:
   * a refusal would confirm that the id names something real.
   */
  async requireOwned(projectId: string, ownerId: string): Promise<ProjectDto> {
    const project = await this.repository.findById(projectId);
    if (!project || project.userId !== ownerId) throw new NotFoundError("Project not found");
    return toProjectDto(project);
  }

  /**
   * The same answer as `requireOwned`, for the key the runtime routes by. A
   * key names one project across the whole install, so someone else's reads as
   * missing here for the reason it does there.
   */
  async requireOwnedByKey(key: string, ownerId: string): Promise<ProjectDto> {
    const project = await this.repository.findByKey(key);
    if (!project || project.userId !== ownerId) throw new NotFoundError("Project not found");
    return toProjectDto(project);
  }

  /**
   * The key this project's outbound action requests are signed with, minted the
   * first time anything needs one. Nothing here decides who may ask: a caller
   * has been authorized long before it gets this far, the same way the customer
   * pool works.
   *
   * Minting lazily rather than at creation keeps a project that never calls out
   * from holding a secret at all — an unused key is a liability with no
   * corresponding use.
   */
  async actionSecret(projectId: string): Promise<string> {
    const project = await this.repository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");
    if (project.actionSecret) return this.crypto.decrypt(project.actionSecret);

    const stored = await this.repository.claimActionSecret(
      projectId,
      this.crypto.encrypt(createActionSecret()),
    );
    if (!stored) throw new NotFoundError("Project not found");
    return this.crypto.decrypt(stored);
  }

  /**
   * The same secret, for the owner who has to put it into the other side. This
   * is the only response that ever carries it in the clear: the column holds
   * ciphertext, and a customer application cannot verify a signature it does
   * not have the key for (DECISIONS #013).
   */
  async revealActionSecret(projectId: string, ownerId: string): Promise<ActionSecretDto> {
    await this.requireOwned(projectId, ownerId);
    return { secret: await this.actionSecret(projectId) };
  }

  /**
   * The project this caller may act on, whoever the caller is. An agent token
   * names exactly one project, so every other project reads as missing to it —
   * the same answer a human gets for someone else's, and for the same reason.
   */
  async requireAccess(principal: Principal, projectId: string): Promise<ProjectDto> {
    if (principal.kind === "user") return this.requireOwned(projectId, principal.userId);

    if (principal.projectId !== projectId) throw new NotFoundError("Project not found");
    const project = await this.repository.findById(projectId);
    if (!project) throw new NotFoundError("Project not found");
    return toProjectDto(project);
  }
}
