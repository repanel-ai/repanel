import { Injectable } from "@nestjs/common";
import type {
  ActionSecretDto,
  CreateProjectRequest,
  ProjectDto,
  ProjectMembershipDto,
  ProjectRole,
} from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import { CryptoService } from "../crypto/crypto.service";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/domain-errors";
import { createActionSecret } from "./action-secret";
import { createProjectKey } from "./project-key";
import { toProjectDto, toProjectMembershipDto } from "./projects.mapper";
import { ProjectsRepository, type MembershipRow } from "./projects.repository";

/**
 * How many keys to draw before giving up. Two draws collide once in 36^6, so
 * a third attempt is already generosity; an unbounded loop would not be.
 */
const KEY_ATTEMPTS = 3;

/**
 * What a caller who is not on a project is told, whatever the project's state.
 * Exported so that the authorization matrix can tell this refusal apart from
 * every other `NotFoundError` the API raises, by the words rather than by luck.
 */
export const PROJECT_NOT_FOUND = "Project not found";

/** What a caller who is on it but may not do this is told. */
const OWNER_ONLY = "Only this project's owner can do that";

/**
 * Whether the role somebody holds meets the one a call asks for. An owner may
 * do anything an operator may — the whole ordering, said once, so no call site
 * has to remember it.
 */
function satisfies(held: ProjectRole, required: ProjectRole): boolean {
  return required === "operator" || held === "owner";
}

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

  /**
   * Everything this person may reach, and what they may do there. An operator
   * is on this list for the same reason an owner is — it is the answer to
   * "where may I go", which is what a console lands somebody on.
   */
  async list(userId: string): Promise<ProjectMembershipDto[]> {
    const memberships = await this.repository.listMembershipsByUser(userId);
    return memberships.map(toProjectMembershipDto);
  }

  /**
   * The project, if this person is on it in a role that carries what is being
   * asked for. It is the one authorization idiom in the API: every route that
   * touches a project comes through here or through `requireMemberByKey`, and
   * names the role it needs rather than assuming one (DECISIONS #062).
   *
   * Two refusals, and the difference is deliberate. Somebody who is not on the
   * project is told it does not exist, because a refusal would confirm that the
   * id names something real. Somebody who is on it and may not do this is told
   * so plainly — they already know the project exists; they work in it.
   */
  async requireMember(projectId: string, userId: string, role: ProjectRole): Promise<ProjectDto> {
    return grant(await this.repository.findMembership(projectId, userId), role);
  }

  /** The same answer, for the key the runtime routes by. */
  async requireMemberByKey(key: string, userId: string, role: ProjectRole): Promise<ProjectDto> {
    return grant(await this.repository.findMembershipByKey(key, userId), role);
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
    if (!project) throw new NotFoundError(PROJECT_NOT_FOUND);
    if (project.actionSecret) return this.crypto.decrypt(project.actionSecret);

    const stored = await this.repository.claimActionSecret(
      projectId,
      this.crypto.encrypt(createActionSecret()),
    );
    if (!stored) throw new NotFoundError(PROJECT_NOT_FOUND);
    return this.crypto.decrypt(stored);
  }

  /**
   * The same secret, for the owner who has to put it into the other side. This
   * is the only response that ever carries it in the clear: the column holds
   * ciphertext, and a customer application cannot verify a signature it does
   * not have the key for (DECISIONS #013). An operator never sees it — they run
   * the actions it signs, and signing is the project's business, not theirs.
   */
  async revealActionSecret(projectId: string, ownerId: string): Promise<ActionSecretDto> {
    await this.requireMember(projectId, ownerId, "owner");
    return { secret: await this.actionSecret(projectId) };
  }

  /**
   * The project this caller may act on, whoever the caller is. An agent token
   * names exactly one project, so every other project reads as missing to it —
   * the same answer a human gets for a project they are not on, and for the
   * same reason. A token holds no role: what it may do is fixed by there being
   * no tool for anything else.
   */
  async requireAccess(
    principal: Principal,
    projectId: string,
    role: ProjectRole,
  ): Promise<ProjectDto> {
    if (principal.kind === "user") return this.requireMember(projectId, principal.userId, role);

    if (principal.projectId !== projectId) throw new NotFoundError(PROJECT_NOT_FOUND);
    const project = await this.repository.findById(projectId);
    if (!project) throw new NotFoundError(PROJECT_NOT_FOUND);
    return toProjectDto(project);
  }
}

/** One place where a membership becomes an answer, so both lookups agree. */
function grant(membership: MembershipRow | undefined, required: ProjectRole): ProjectDto {
  if (!membership) throw new NotFoundError(PROJECT_NOT_FOUND);
  if (!satisfies(membership.role, required)) throw new ForbiddenError(OWNER_ONLY);
  return toProjectDto(membership.project);
}
