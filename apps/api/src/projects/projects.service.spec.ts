import { Test } from "@nestjs/testing";
import type { Principal } from "../auth/principal";
import { ConfigModule } from "../config/config.module";
import { CryptoModule } from "../crypto/crypto.module";
import { CryptoService } from "../crypto/crypto.service";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors/domain-errors";
import { ProjectsRepository } from "./projects.repository";
import { InMemoryProjectsRepository } from "./projects.test-helpers";
import { ProjectsService } from "./projects.service";

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
      const project = await service.create(ADA, { name: "Crewbase" });

      expect(project.key).toMatch(/^crewbase-[a-z0-9]{6}$/);
      expect(project).toEqual({
        id: "project-1",
        name: "Crewbase",
        key: project.key,
        createdAt: expect.any(String),
      });
      expect(repository.projects[0]?.userId).toBe(ADA);
    });

    it("draws another key when the one it offered is taken", async () => {
      repository.refuseNextKeys(1);

      const project = await service.create(ADA, { name: "Crewbase" });

      expect(repository.attemptedKeys).toHaveLength(2);
      expect(repository.attemptedKeys[0]).not.toBe(repository.attemptedKeys[1]);
      expect(project.key).toBe(repository.attemptedKeys[1]);
      expect(project.key).toMatch(KEY_FORMAT);
      expect(repository.projects).toHaveLength(1);
    });

    it("gives up rather than draw keys forever", async () => {
      repository.refuseNextKeys(10);

      const refusal = await refusalFrom(service.create(ADA, { name: "Crewbase" }));

      expect(refusal).toBeInstanceOf(ConflictError);
      expect(repository.attemptedKeys).toHaveLength(3);
      expect(repository.projects).toEqual([]);
    });

    it("does not retry a failure that has nothing to do with the key", async () => {
      const outage = new Error("connection lost");
      const failing = { create: () => Promise.reject(outage) } as unknown as ProjectsRepository;

      await expect(
        new ProjectsService(failing, crypto).create(ADA, { name: "Crewbase" }),
      ).rejects.toBe(outage);
    });
  });

  describe("list", () => {
    it("answers with what the caller may reach, and what they may do there", async () => {
      const crewbase = await service.create(ADA, { name: "Crewbase" });
      const ledger = await service.create(ADA, { name: "Ledger" });
      await service.create(GRACE, { name: "Compiler" });

      const listed = await service.list(ADA);

      expect(listed).toHaveLength(2);
      expect(listed).toEqual(
        expect.arrayContaining([
          { project: crewbase, role: "owner" },
          { project: ledger, role: "owner" },
        ]),
      );
    });

    it("puts a project the caller only operates on the same list", async () => {
      const compiler = await service.create(GRACE, { name: "Compiler" });
      await repository.addMember({ projectId: compiler.id, userId: ADA, role: "operator" });

      await expect(service.list(ADA)).resolves.toEqual([{ project: compiler, role: "operator" }]);
    });

    it("answers a user who is on nothing with an empty list", async () => {
      await service.create(GRACE, { name: "Compiler" });

      await expect(service.list(ADA)).resolves.toEqual([]);
    });
  });

  describe("requireMember", () => {
    it("answers with the project when the caller owns it", async () => {
      const project = await service.create(ADA, { name: "Crewbase" });

      await expect(service.requireMember(project.id, ADA, "owner")).resolves.toEqual(project);
    });

    it("lets an owner through a door that only asks for an operator", async () => {
      const project = await service.create(ADA, { name: "Crewbase" });

      await expect(service.requireMember(project.id, ADA, "operator")).resolves.toEqual(project);
    });

    it("lets an operator through the doors that ask for an operator", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });
      await repository.addMember({ projectId: project.id, userId: ADA, role: "operator" });

      await expect(service.requireMember(project.id, ADA, "operator")).resolves.toEqual(project);
    });

    it("refuses an operator at an owner's door, plainly rather than as missing", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });
      await repository.addMember({ projectId: project.id, userId: ADA, role: "operator" });

      const refusal = await refusalFrom(service.requireMember(project.id, ADA, "owner"));

      // They work in this project every day: hiding it would be a lie they
      // could disprove, and it would not hide anything they do not know.
      expect(refusal).toBeInstanceOf(ForbiddenError);
    });

    it("answers a project the caller is not on as missing, not as forbidden", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.requireMember(project.id, ADA, "operator"));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers an id no project carries the same way", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const somebodyElses = await refusalFrom(service.requireMember(project.id, ADA, "owner"));
      const nothingAtAll = await refusalFrom(service.requireMember("project-404", ADA, "owner"));

      expect(nothingAtAll).toBeInstanceOf(NotFoundError);
      // Told apart, the two would let a caller probe for other people's ids.
      expect(nothingAtAll.message).toBe(somebodyElses.message);
    });

    it("refuses somebody whose membership has been revoked", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });
      await repository.addMember({ projectId: project.id, userId: ADA, role: "operator" });
      await repository.removeMember(project.id, ADA);

      const refusal = await refusalFrom(service.requireMember(project.id, ADA, "operator"));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("requireMemberByKey", () => {
    it("answers with the project when the key names one the caller is on", async () => {
      const project = await service.create(ADA, { name: "Crewbase" });

      await expect(service.requireMemberByKey(project.key, ADA, "operator")).resolves.toEqual(
        project,
      );
    });

    it("answers a key for a project the caller is not on as missing", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.requireMemberByKey(project.key, ADA, "operator"));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("refuses an operator's key at an owner's door", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });
      await repository.addMember({ projectId: project.id, userId: ADA, role: "operator" });

      const refusal = await refusalFrom(service.requireMemberByKey(project.key, ADA, "owner"));

      expect(refusal).toBeInstanceOf(ForbiddenError);
    });

    it("answers a key no project carries the same way", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const somebodyElses = await refusalFrom(
        service.requireMemberByKey(project.key, ADA, "operator"),
      );
      const nothingAtAll = await refusalFrom(
        service.requireMemberByKey("compiler-zzzzzz", ADA, "operator"),
      );

      expect(nothingAtAll).toBeInstanceOf(NotFoundError);
      // A key is guessable in a way an id is not, so telling the two apart here
      // would be the more useful oracle of the two.
      expect(nothingAtAll.message).toBe(somebodyElses.message);
    });
  });

  describe("actionSecret", () => {
    it("mints a secret the first time one is needed, and stores it encrypted", async () => {
      const project = await service.create(ADA, { name: "Crewbase" });

      const secret = await service.actionSecret(project.id);

      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const stored = repository.projects[0]?.actionSecret;
      expect(stored).toBeDefined();
      expect(stored).not.toContain(secret);
      expect(crypto.decrypt(stored as string)).toBe(secret);
    });

    it("answers with the same secret every time after that", async () => {
      const project = await service.create(ADA, { name: "Crewbase" });

      const first = await service.actionSecret(project.id);
      const again = await service.actionSecret(project.id);

      expect(again).toBe(first);
      // A signature nothing can verify is worse than no signature: the second
      // call must read what is stored rather than write over it.
      expect(repository.claims).toBe(1);
    });

    it("gives two projects two different secrets", async () => {
      const crewbase = await service.create(ADA, { name: "Crewbase" });
      const compiler = await service.create(GRACE, { name: "Compiler" });

      expect(await service.actionSecret(crewbase.id)).not.toBe(
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
      const project = await service.create(ADA, { name: "Crewbase" });

      const [signing, revealed] = await Promise.all([
        service.actionSecret(project.id),
        service.revealActionSecret(project.id, ADA),
      ]);

      expect(revealed.secret).toBe(signing);
    });
  });

  describe("revealActionSecret", () => {
    it("answers the owner with the plaintext their application needs", async () => {
      const project = await service.create(ADA, { name: "Crewbase" });

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
      const project = await service.create(ADA, { name: "Crewbase" });

      await expect(service.requireAccess(asUser(ADA), project.id, "owner")).resolves.toEqual(
        project,
      );
    });

    it("answers a user asking after someone else's project as missing", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(service.requireAccess(asUser(ADA), project.id, "owner"));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers an agent with the project its token names", async () => {
      const project = await service.create(ADA, { name: "Crewbase" });

      await expect(service.requireAccess(asAgent(project.id), project.id, "owner")).resolves.toEqual(
        project,
      );
    });

    it("answers an agent asking after any other project as missing", async () => {
      const crewbase = await service.create(ADA, { name: "Crewbase" });
      const compiler = await service.create(GRACE, { name: "Compiler" });

      const refusal = await refusalFrom(
        service.requireAccess(asAgent(crewbase.id), compiler.id, "owner"),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers an agent whose project has since been deleted as missing", async () => {
      // The token outlives nothing: a project that is gone is gone for it too.
      const refusal = await refusalFrom(
        service.requireAccess(asAgent("project-deleted"), "project-deleted", "owner"),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
    });

    it("answers an operator at a door that asks for an operator", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });
      await repository.addMember({ projectId: project.id, userId: ADA, role: "operator" });

      await expect(service.requireAccess(asUser(ADA), project.id, "operator")).resolves.toEqual(
        project,
      );
    });

    it("refuses an operator at a door that asks for an owner", async () => {
      const project = await service.create(GRACE, { name: "Compiler" });
      await repository.addMember({ projectId: project.id, userId: ADA, role: "operator" });

      const refusal = await refusalFrom(service.requireAccess(asUser(ADA), project.id, "owner"));

      expect(refusal).toBeInstanceOf(ForbiddenError);
    });

    it("does not tell a user and an agent apart when refusing", async () => {
      const compiler = await service.create(GRACE, { name: "Compiler" });

      const asHuman = await refusalFrom(service.requireAccess(asUser(ADA), compiler.id, "owner"));
      const asToken = await refusalFrom(
        service.requireAccess(asAgent("project-404"), compiler.id, "owner"),
      );

      expect(asToken.message).toBe(asHuman.message);
    });
  });
});
