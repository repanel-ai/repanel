import type { ProjectRole, SignupRequest, UserDto } from "@repanel/contracts";
import type { AuthService } from "../auth/auth.service";
import { ConflictError } from "../errors/domain-errors";
import {
  ProjectsRepository,
  type MembershipRow,
  type NewProjectMemberRow,
  type NewProjectRow,
  type ProjectMemberRow,
  type ProjectRow,
} from "./projects.repository";

/**
 * The projects feature's tables, in memory. It is shared rather than copied
 * because three suites need the same behavior — the service's own cases, the
 * People surface, and the authorization matrix — and three copies of "what
 * Postgres does about a taken key" would be three chances to disagree.
 */
type ProjectStore = Pick<
  ProjectsRepository,
  | "create"
  | "findById"
  | "findMembership"
  | "findMembershipByKey"
  | "listMembershipsByUser"
  | "listMembers"
  | "addMember"
  | "removeMember"
  | "claimActionSecret"
>;

export class InMemoryProjectsRepository implements ProjectStore {
  readonly projects: ProjectRow[] = [];
  /** Every key the service has offered, in the order it offered them. */
  readonly attemptedKeys: string[] = [];
  private refusals = 0;

  readonly members: ProjectMemberRow[] = [];

  create(project: NewProjectRow): Promise<ProjectRow> {
    this.attemptedKeys.push(project.key);
    if (this.refusals > 0) {
      this.refusals -= 1;
      return Promise.reject(new ConflictError("Project key is already taken"));
    }
    if (this.projects.some((existing) => existing.key === project.key)) {
      return Promise.reject(new ConflictError("Project key is already taken"));
    }

    const created: ProjectRow = {
      id: `project-${this.projects.length + 1}`,
      userId: project.userId,
      name: project.name,
      key: project.key,
      actionSecret: null,
      createdAt: new Date(),
    };
    this.projects.push(created);
    // The real one writes both rows in one transaction: a project always has
    // the owner it was created by, or it does not exist.
    this.members.push({
      id: `member-${this.members.length + 1}`,
      projectId: created.id,
      userId: created.userId,
      role: "owner",
      createdAt: new Date(),
    });
    return Promise.resolve(created);
  }

  findById(id: string): Promise<ProjectRow | undefined> {
    return Promise.resolve(this.projects.find((project) => project.id === id));
  }

  findMembership(projectId: string, userId: string): Promise<MembershipRow | undefined> {
    return Promise.resolve(
      this.membershipsOf(userId).find((row) => row.project.id === projectId),
    );
  }

  findMembershipByKey(key: string, userId: string): Promise<MembershipRow | undefined> {
    return Promise.resolve(this.membershipsOf(userId).find((row) => row.project.key === key));
  }

  listMembershipsByUser(userId: string): Promise<MembershipRow[]> {
    return Promise.resolve(this.membershipsOf(userId));
  }

  listMembers(projectId: string): Promise<ProjectMemberRow[]> {
    return Promise.resolve(this.members.filter((member) => member.projectId === projectId));
  }

  addMember(member: NewProjectMemberRow): Promise<ProjectMemberRow> {
    const taken = this.members.some(
      (existing) =>
        existing.projectId === member.projectId && existing.userId === member.userId,
    );
    if (taken) return Promise.reject(new ConflictError("They are already on this project"));

    const added: ProjectMemberRow = {
      id: `member-${this.members.length + 1}`,
      projectId: member.projectId,
      userId: member.userId,
      role: member.role,
      createdAt: new Date(),
    };
    this.members.push(added);
    return Promise.resolve(added);
  }

  removeMember(projectId: string, userId: string): Promise<void> {
    const at = this.members.findIndex(
      (member) => member.projectId === projectId && member.userId === userId,
    );
    if (at >= 0) this.members.splice(at, 1);
    return Promise.resolve();
  }

  /** The join the real repository does, in the order it does it. */
  private membershipsOf(userId: string): MembershipRow[] {
    return this.members
      .filter((member) => member.userId === userId)
      .flatMap((member) => {
        const project = this.projects.find((candidate) => candidate.id === member.projectId);
        return project ? [{ project, role: member.role }] : [];
      });
  }

  /** The same `is null` predicate Postgres applies: the first write wins. */
  claimActionSecret(projectId: string, encrypted: string): Promise<string | undefined> {
    const project = this.projects.find((candidate) => candidate.id === projectId);
    if (!project) return Promise.resolve(undefined);
    project.actionSecret ??= encrypted;
    this.claims += 1;
    return Promise.resolve(project.actionSecret);
  }

  /** How many times a secret was written for, however many were stored. */
  claims = 0;

  /** Stands in for the collision the suffix exists to make unlikely. */
  refuseNextKeys(count: number): void {
    this.refusals = count;
  }
}

/** Stands in for the auth feature: it owns `users`, so it owns the accounts. */
export class InMemoryAccounts
  implements Pick<AuthService, "createAccount" | "findAccountByEmail" | "accountsFor">
{
  readonly accounts: UserDto[] = [];
  /** Every password an account was created with, by address. */
  readonly passwords = new Map<string, string>();

  createAccount(request: SignupRequest): Promise<UserDto> {
    if (this.accounts.some((account) => account.email === request.email)) {
      return Promise.reject(new ConflictError("Email already registered"));
    }

    const account: UserDto = {
      id: `user-${this.accounts.length + 1}`,
      email: request.email,
      name: request.name,
    };
    this.accounts.push(account);
    this.passwords.set(account.email, request.password);
    return Promise.resolve(account);
  }

  findAccountByEmail(email: string): Promise<UserDto | null> {
    return Promise.resolve(this.accounts.find((account) => account.email === email) ?? null);
  }

  accountsFor(userIds: string[]): Promise<UserDto[]> {
    return Promise.resolve(this.accounts.filter((account) => userIds.includes(account.id)));
  }
}
