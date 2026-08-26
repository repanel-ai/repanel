import type { AuthService } from "../auth/auth.service";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/domain-errors";
import { PeopleService } from "./people.service";
import type { ProjectsRepository } from "./projects.repository";
import { ProjectsService } from "./projects.service";
import { InMemoryAccounts, InMemoryProjectsRepository } from "./projects.test-helpers";

const ADA = "user-ada";
const GRACE = "user-grace";

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("PeopleService", () => {
  let repository: InMemoryProjectsRepository;
  let accounts: InMemoryAccounts;
  let projects: ProjectsService;
  let people: PeopleService;
  let projectId: string;

  beforeEach(async () => {
    repository = new InMemoryProjectsRepository();
    accounts = new InMemoryAccounts();
    projects = new ProjectsService(
      repository as unknown as ProjectsRepository,
      // Nothing here mints a secret; the crypto service is never reached.
      {} as never,
    );
    people = new PeopleService(
      projects,
      repository as unknown as ProjectsRepository,
      accounts as unknown as AuthService,
    );

    accounts.accounts.push({ id: ADA, email: "ada@example.com", name: "Ada" });
    projectId = (await projects.create(ADA, { name: "Crewbase" })).id;
  });

  describe("addOperator", () => {
    it("creates the login, shows its password once, and stores no plaintext", async () => {
      const added = await people.addOperator(ADA, projectId, {
        email: "ravi@example.com",
        name: "Ravi",
      });

      expect(added.person).toEqual({
        userId: "user-2",
        email: "ravi@example.com",
        name: "Ravi",
        role: "operator",
        addedAt: expect.any(String),
      });
      expect(added.password).toMatch(/^[A-Za-z0-9]{20}$/);
      // What the owner was handed is what the account was created with, and the
      // only copy: the People list never carries it again.
      expect(accounts.passwords.get("ravi@example.com")).toBe(added.password);
      expect(JSON.stringify(await people.list(ADA, projectId))).not.toContain(added.password);
    });

    it("draws a different password every time", async () => {
      const first = await people.addOperator(ADA, projectId, {
        email: "ravi@example.com",
        name: "Ravi",
      });
      const second = await people.addOperator(ADA, projectId, {
        email: "sam@example.com",
        name: "Sam",
      });

      expect(second.password).not.toBe(first.password);
    });

    it("adds somebody who already has a RePanel account without a password", async () => {
      accounts.accounts.push({ id: GRACE, email: "grace@example.com", name: "Grace" });

      const added = await people.addOperator(ADA, projectId, {
        email: "grace@example.com",
        name: "Whatever The Owner Typed",
      });

      expect(added.password).toBeNull();
      // Their name is theirs: an owner adding them does not get to rewrite it.
      expect(added.person).toMatchObject({ userId: GRACE, name: "Grace", role: "operator" });
    });

    it("refuses to add the same person twice", async () => {
      await people.addOperator(ADA, projectId, { email: "ravi@example.com", name: "Ravi" });

      const refusal = await refusalFrom(
        people.addOperator(ADA, projectId, { email: "ravi@example.com", name: "Ravi" }),
      );

      expect(refusal).toBeInstanceOf(ConflictError);
    });

    it("refuses to add the owner as an operator of their own project", async () => {
      const refusal = await refusalFrom(
        people.addOperator(ADA, projectId, { email: "ada@example.com", name: "Ada" }),
      );

      expect(refusal).toBeInstanceOf(ConflictError);
    });

    it("does not let an operator put anybody on the project", async () => {
      const { person } = await people.addOperator(ADA, projectId, {
        email: "ravi@example.com",
        name: "Ravi",
      });

      const refusal = await refusalFrom(
        people.addOperator(person.userId, projectId, { email: "mole@example.com", name: "Mole" }),
      );

      expect(refusal).toBeInstanceOf(ForbiddenError);
      expect(await people.list(ADA, projectId)).toHaveLength(2);
    });

    it("does not let a stranger put anybody on the project, or learn it exists", async () => {
      const refusal = await refusalFrom(
        people.addOperator(GRACE, projectId, { email: "mole@example.com", name: "Mole" }),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      // Nothing was created on the way to being refused.
      expect(accounts.accounts.map((account) => account.email)).toEqual(["ada@example.com"]);
    });
  });

  describe("list", () => {
    it("answers with the owner first and the operators after them", async () => {
      await people.addOperator(ADA, projectId, { email: "ravi@example.com", name: "Ravi" });

      const listed = await people.list(ADA, projectId);

      expect(listed.map((person) => [person.email, person.role])).toEqual([
        ["ada@example.com", "owner"],
        ["ravi@example.com", "operator"],
      ]);
    });

    it("does not answer an operator, who has no business administering people", async () => {
      const { person } = await people.addOperator(ADA, projectId, {
        email: "ravi@example.com",
        name: "Ravi",
      });

      const refusal = await refusalFrom(people.list(person.userId, projectId));

      expect(refusal).toBeInstanceOf(ForbiddenError);
    });
  });

  describe("revoke", () => {
    it("takes the operator off the project, and their access with them", async () => {
      const { person } = await people.addOperator(ADA, projectId, {
        email: "ravi@example.com",
        name: "Ravi",
      });
      const project = await projects.requireMember(projectId, person.userId, "operator");

      await people.revoke(ADA, projectId, person.userId);

      expect(project.id).toBe(projectId);
      const refusal = await refusalFrom(
        projects.requireMember(projectId, person.userId, "operator"),
      );
      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("leaves the account alone: it may be on somebody else's project", async () => {
      const { person } = await people.addOperator(ADA, projectId, {
        email: "ravi@example.com",
        name: "Ravi",
      });

      await people.revoke(ADA, projectId, person.userId);

      expect(await accounts.findAccountByEmail("ravi@example.com")).not.toBeNull();
    });

    it("refuses to remove the owner", async () => {
      const refusal = await refusalFrom(people.revoke(ADA, projectId, ADA));

      expect(refusal).toBeInstanceOf(ConflictError);
      expect(await people.list(ADA, projectId)).toHaveLength(1);
    });

    it("refuses for somebody who is not on the project at all", async () => {
      const refusal = await refusalFrom(people.revoke(ADA, projectId, GRACE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("does not let an operator revoke anybody, including the owner", async () => {
      const { person } = await people.addOperator(ADA, projectId, {
        email: "ravi@example.com",
        name: "Ravi",
      });

      const refusal = await refusalFrom(people.revoke(person.userId, projectId, ADA));

      expect(refusal).toBeInstanceOf(ForbiddenError);
      expect(await people.list(ADA, projectId)).toHaveLength(2);
    });
  });
});
