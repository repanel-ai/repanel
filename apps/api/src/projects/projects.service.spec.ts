import { Test } from "@nestjs/testing";
import { ConflictError, NotFoundError } from "../errors/domain-errors";
import { ProjectsRepository, type NewProjectRow, type ProjectRow } from "./projects.repository";
import { ProjectsService } from "./projects.service";

type ProjectStore = Pick<ProjectsRepository, "create" | "findById" | "listByOwner">;

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
      createdAt: new Date(),
    };
    this.projects.push(created);
    return Promise.resolve(created);
  }

  findById(id: string): Promise<ProjectRow | undefined> {
    return Promise.resolve(this.projects.find((project) => project.id === id));
  }

  listByOwner(ownerId: string): Promise<ProjectRow[]> {
    return Promise.resolve(this.projects.filter((project) => project.userId === ownerId));
  }

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
  let service: ProjectsService;

  beforeEach(async () => {
    repository = new InMemoryProjectsRepository();
    const moduleRef = await Test.createTestingModule({
      providers: [ProjectsService, { provide: ProjectsRepository, useValue: repository }],
    }).compile();

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

      await expect(new ProjectsService(failing).create(ADA, { name: "SkyScout" })).rejects.toBe(
        outage,
      );
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
});
