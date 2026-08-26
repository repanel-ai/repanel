import { Injectable } from "@nestjs/common";
import type { AddOperatorRequest, AddedPersonDto, PersonDto, UserDto } from "@repanel/contracts";
import { AuthService } from "../auth/auth.service";
import { ConflictError, NotFoundError } from "../errors/domain-errors";
import { createOperatorPassword } from "./operator-password";
import { toPersonDto } from "./people.mapper";
import { ProjectsRepository, type ProjectMemberRow } from "./projects.repository";
import { ProjectsService } from "./projects.service";

const NOT_ON_THE_PROJECT = "They are not on this project";
const OWNER_STAYS = "A project's owner cannot be removed";

/**
 * Who is on a project, as its owner administers it. Every method here asks for
 * `owner` and asks first: deciding who may use an admin is the one thing an
 * operator must never be able to do (DECISIONS #062).
 *
 * It lives beside `ProjectsService` rather than in it because it is a different
 * job — that one answers "may this caller", this one changes the answer — and
 * it reads the same feature's tables through the same repository.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly projects: ProjectsService,
    private readonly repository: ProjectsRepository,
    private readonly auth: AuthService,
  ) {}

  /** Everyone on the project, owner first, with the person behind each row. */
  async list(ownerId: string, projectId: string): Promise<PersonDto[]> {
    await this.projects.requireMember(projectId, ownerId, "owner");

    const members = await this.repository.listMembers(projectId);
    const accounts = await this.auth.accountsFor(members.map((member) => member.userId));
    const byId = new Map(accounts.map((account) => [account.id, account]));

    return members.map((member) => toPersonDto(member, accountOf(byId, member)));
  }

  /**
   * Puts somebody on the project as an operator, creating their login if RePanel
   * does not know the address yet.
   *
   * The password comes back exactly once and is stored only as a hash, the way
   * an agent token is (DECISIONS #062). An address that already has an account
   * is added without one — the owner needs to know that, because it is the
   * difference between having something to pass on and having nothing to.
   */
  async addOperator(
    ownerId: string,
    projectId: string,
    { email, name }: AddOperatorRequest,
  ): Promise<AddedPersonDto> {
    await this.projects.requireMember(projectId, ownerId, "owner");

    const existing = await this.auth.findAccountByEmail(email);
    if (existing) return { person: await this.put(projectId, existing), password: null };

    const password = createOperatorPassword();
    const account = await this.auth.createAccount({ email, name, password });

    return { person: await this.put(projectId, account), password };
  }

  /**
   * Takes an operator off the project. The row is the whole of their access, so
   * deleting it is the whole of revoking it: the next request they make is
   * refused, whatever session they are holding.
   *
   * The owner is not removable. There is no transfer in v1, and a project with
   * nobody who can configure it is a project nobody can fix.
   */
  async revoke(ownerId: string, projectId: string, userId: string): Promise<void> {
    await this.projects.requireMember(projectId, ownerId, "owner");

    const membership = await this.repository.findMembership(projectId, userId);
    if (!membership) throw new NotFoundError(NOT_ON_THE_PROJECT);
    if (membership.role === "owner") throw new ConflictError(OWNER_STAYS);

    await this.repository.removeMember(projectId, userId);
  }

  /** Files the membership and says who it is for. */
  private async put(projectId: string, account: UserDto): Promise<PersonDto> {
    const member = await this.repository.addMember({
      projectId,
      userId: account.id,
      role: "operator",
    });

    return toPersonDto(member, account);
  }
}

/**
 * The account a membership names. The foreign key makes its absence impossible,
 * so this is an assertion rather than a case: answering with a person whose
 * name we made up would be worse than not answering.
 */
function accountOf(accounts: Map<string, UserDto>, member: ProjectMemberRow): UserDto {
  const account = accounts.get(member.userId);
  if (!account) throw new Error(`Project member ${member.id} has no account`);
  return account;
}
