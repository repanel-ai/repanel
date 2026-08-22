import { Test } from "@nestjs/testing";
import type { Principal } from "../auth/principal";
import { ConfigModule } from "../config/config.module";
import { CryptoModule } from "../crypto/crypto.module";
import { CryptoService } from "../crypto/crypto.service";
import { ConflictError, NotFoundError } from "../errors/domain-errors";
import { ProjectsRepository, type NewProjectRow, type ProjectRow } from "./projects.repository";
import { ProjectsService } from "./projects.service";

type ProjectStore = Pick<
  ProjectsRepository,
  "create" | "findById" | "findByKey" | "listByOwner" | "claimActionSecret"
>;

/** Stands in for Postgres: same behavior, including how a taken key is refused. */
class InMemoryProjectsRepository implements ProjectStore {
  readonly projects: ProjectRow[] = [];
  /** Every key the service has offered, in the order it offered them. */
  readonly attemptedKeys: string[] = [];
  private refusals = 0;

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
    return Promise.resolve(created);
  }

  findById(id: string): Promise<ProjectRow | undefined> {
    return Promise.resolve(this.projects.find((project) => project.id === id));
  }

  findByKey(key: string): Promise<ProjectRow | undefined> {
    return Promise.resolve(this.projects.find((project) => project.key === key));
  }

  listByOwner(ownerId: string): Promise<ProjectRow[]> {
    return Promise.resolve(this.projects.filter((project) => project.userId === ownerId));
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

const ADA = "user-ada";
const GRACE = "user-grace";
const KEY_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-z0-9]{6}$/;

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("ProjectsService", () => {
  let repository: InMemoryProjectsRepository;
  let crypto: CryptoService;
  let service: ProjectsService;

  beforeEach(async () => {
    repository = new InMemoryProjectsRepository();
    const moduleRef = await Test.createTestingModule({
      // The real CryptoService, on the suite's throwaway key: what a secret
      // looks like in the column is half of what these cases are about.
      imports: [ConfigModule, CryptoModule],
      providers: [ProjectsService, { provide: ProjectsRepository, useValue: repository }],
    }).compile();

    crypto = moduleRef.get(CryptoService);
    service = moduleRef.get(ProjectsService);
  });

  describe("create", () => {
    it("gives the project a key of its own and files it under its owner", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      expect(project.key).toMatch(/^skyscout-[a-z0-9]{6}$/);
      expect(project).toEqual({
        id: "project-1",
        name: "SkyScout",
        key: project.key,
        createdAt: expect.any(String),
      });
      expect(repository.projects[0]?.userId).toBe(ADA);
    });

    it("draws another key when the one it offered is taken", async () => {
      repository.refuseNextKeys(1);

      const project = await service.create(ADA, { name: "SkyScout" });

      expect(repository.attemptedKeys).toHaveLength(2);
      expect(repository.attemptedKeys[0]).not.toBe(repository.attemptedKeys[1]);
      expect(project.key).toBe(repository.attemptedKeys[1]);
      expect(project.key).toMatch(KEY_FORMAT);
      expect(repository.projects).toHaveLength(1);
    });

    it("gives up rather than draw keys forever", async () => {
      repository.refuseNextKeys(10);

      const refusal = await refusalFrom(service.create(ADA, { name: "SkyScout" }));

      expect(refusal).toBeInstanceOf(ConflictError);
      expect(repository.attemptedKeys).toHaveLength(3);
      expect(repository.projects).toEqual([]);
    });

    it("does not retry a failure that has nothing to do with the key", async () => {
      const outage = new Error("connection lost");
      const failing = { create: () => Promise.reject(outage) } as unknown as ProjectsRepository;

      await expect(
        new ProjectsService(failing, crypto).create(ADA, { name: "SkyScout" }),
      ).rejects.toBe(outage);
    });
  });

  describe("list", () => {
    it("answers with the caller's own projects and nobody else's", async () => {
      const skyscout = await service.create(ADA, { name: "SkyScout" });
      const ledger = await service.create(ADA, { name: "Ledger" });
      await service.create(GRACE, { name: "Compiler" });

      const listed = await service.list(ADA);

      expect(listed).toHaveLength(2);
      expect(listed).toEqual(expect.arrayContaining([skyscout, ledger]));
    });

    it("answers a user who owns nothing with an empty list", async () => {
      await service.create(GRACE, { name: "Compiler" });

      await expect(service.list(ADA)).resolves.toEqual([]);
    });
  });

  describe("requireOwned", () => {
    it("answers with the project when it is the caller's", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      await expect(service.requireOwned(project.id, ADA)).resolves.toEqual(project);
    });

    it("answers another user's project as missing, not as forbidden", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.requireOwned(project.id, ADA));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers an id no project carries the same way", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const somebodyElses = await refusalFrom(service.requireOwned(project.id, ADA));
      const nothingAtAll = await refusalFrom(service.requireOwned("project-404", ADA));

      expect(nothingAtAll).toBeInstanceOf(NotFoundError);
      // Told apart, the two would let a caller probe for other people's ids.
      expect(nothingAtAll.message).toBe(somebodyElses.message);
    });
  });

  describe("requireOwnedByKey", () => {
    it("answers with the project when the key is the caller's", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      await expect(service.requireOwnedByKey(project.key, ADA)).resolves.toEqual(project);
    });

    it("answers another user's key as missing, not as forbidden", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.requireOwnedByKey(project.key, ADA));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers a key no project carries the same way", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const somebodyElses = await refusalFrom(service.requireOwnedByKey(project.key, ADA));
      const nothingAtAll = await refusalFrom(service.requireOwnedByKey("compiler-zzzzzz", ADA));

      expect(nothingAtAll).toBeInstanceOf(NotFoundError);
      // A key is guessable in a way an id is not, so telling the two apart here
      // would be the more useful oracle of the two.
      expect(nothingAtAll.message).toBe(somebodyElses.message);
    });
  });

  describe("actionSecret", () => {
    it("mints a secret the first time one is needed, and stores it encrypted", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      const secret = await service.actionSecret(project.id);

      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const stored = repository.projects[0]?.actionSecret;
      expect(stored).toBeDefined();
      expect(stored).not.toContain(secret);
      expect(crypto.decrypt(stored as string)).toBe(secret);
    });

    it("answers with the same secret every time after that", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      const first = await service.actionSecret(project.id);
      const again = await service.actionSecret(project.id);

      expect(again).toBe(first);
      // A signature nothing can verify is worse than no signature: the second
      // call must read what is stored rather than write over it.
      expect(repository.claims).toBe(1);
    });

    it("gives two projects two different secrets", async () => {
      const skyscout = await service.create(ADA, { name: "SkyScout" });
      const compiler = await service.create(GRACE, { name: "Compiler" });

      expect(await service.actionSecret(skyscout.id)).not.toBe(
        await service.actionSecret(compiler.id),
      );
    });

    it("has no secret for a project that is not there", async () => {
      const refusal = await refusalFrom(service.actionSecret("project-404"));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    /**
     * Two first uses racing — an action signing while the owner reads the key
     * out of the console — must end up signing and verifying with one value.
     */
    it("hands both sides of a race the secret that landed", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      const [signing, revealed] = await Promise.all([
        service.actionSecret(project.id),
        service.revealActionSecret(project.id, ADA),
      ]);

      expect(revealed.secret).toBe(signing);
    });
  });

  describe("revealActionSecret", () => {
    it("answers the owner with the plaintext their application needs", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      const revealed = await service.revealActionSecret(project.id, ADA);

      expect(revealed).toEqual({ secret: await service.actionSecret(project.id) });
    });

    it("does not answer anybody else, and does not mint one for them", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.revealActionSecret(project.id, ADA));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.projects[0]?.actionSecret).toBeNull();
    });
  });

  describe("requireAccess", () => {
    const asUser = (userId: string): Principal => ({ kind: "user", userId });
    const asAgent = (projectId: string): Principal => ({ kind: "agent", projectId });

    it("answers a user with the project they own", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      await expect(service.requireAccess(asUser(ADA), project.id)).resolves.toEqual(project);
    });

    it("answers a user asking after someone else's project as missing", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.requireAccess(asUser(ADA), project.id));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers an agent with the project its token names", async () => {
      const project = await service.create(ADA, { name: "SkyScout" });

      await expect(service.requireAccess(asAgent(project.id), project.id)).resolves.toEqual(
        project,
      );
    });

    it("answers an agent asking after any other project as missing", async () => {
      const skyscout = await service.create(ADA, { name: "SkyScout" });
      const compiler = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.requireAccess(asAgent(skyscout.id), compiler.id));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers an agent whose project has since been deleted as missing", async () => {
      // The token outlives nothing: a project that is gone is gone for it too.
      const refusal = await refusalFrom(
        service.requireAccess(asAgent("project-deleted"), "project-deleted"),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("does not tell a user and an agent apart when refusing", async () => {
      const compiler = await service.create(GRACE, { name: "Compiler" });

      const asHuman = await refusalFrom(service.requireAccess(asUser(ADA), compiler.id));
      const asToken = await refusalFrom(service.requireAccess(asAgent("project-404"), compiler.id));

      expect(asToken.message).toBe(asHuman.message);
    });
  });
});
