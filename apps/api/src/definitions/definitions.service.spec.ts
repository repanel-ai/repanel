import { Test } from "@nestjs/testing";
import {
  validateDefinition,
  type ProjectDto,
  type ValidationError,
  type ValidationResult,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { NotFoundError, ValidationFailedError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { MAX_PAYLOAD_BYTES } from "./definition-size";
import {
  DefinitionsRepository,
  type DefinitionRow,
  type NewDefinitionRow,
} from "./definitions.repository";
import { DefinitionsService } from "./definitions.service";

const ADA = "user-ada";
const GRACE = "user-grace";
const SKYSCOUT = "project-skyscout";

const PROJECT: ProjectDto = {
  id: SKYSCOUT,
  name: "SkyScout",
  key: "skyscout-a3k9x2",
  createdAt: "2026-08-18T12:00:00.000Z",
};

/** A definition missing everything below `app`, so validation has plenty to say. */
const BROKEN = { schemaVersion: "0.1", app: { name: "Acme Admin" } };

/**
 * What a jsonb column gives back: an equal value, never the same object, and
 * with its keys reordered. Every assertion below compares deeply for that
 * reason — a stored definition is equal to what was submitted, not identical.
 */
function throughJsonb<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type DefinitionStore = Pick<DefinitionsRepository, "save" | "findByProjectId">;

/** Stands in for Postgres, including the one-row-per-project constraint. */
class InMemoryDefinitionsRepository implements DefinitionStore {
  readonly rows: DefinitionRow[] = [];

  save(draft: NewDefinitionRow): Promise<DefinitionRow> {
    const previous = this.rows.find((row) => row.projectId === draft.projectId);
    const saved: DefinitionRow = {
      id: previous?.id ?? `definition-${this.rows.length + 1}`,
      projectId: draft.projectId,
      payload: throughJsonb(draft.payload),
      valid: draft.valid,
      errors: throughJsonb(draft.errors ?? null),
      createdAt: previous?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    // The project id is unique: a resubmission replaces, it never adds.
    if (previous) this.rows.splice(this.rows.indexOf(previous), 1, saved);
    else this.rows.push(saved);
    return Promise.resolve(saved);
  }

  findByProjectId(projectId: string): Promise<DefinitionRow | undefined> {
    return Promise.resolve(this.rows.find((row) => row.projectId === projectId));
  }
}

/** Stands in for the projects feature: Ada owns SkyScout, nobody else does. */
class OwnedProjects implements Pick<ProjectsService, "requireOwned"> {
  requireOwned(projectId: string, ownerId: string): Promise<ProjectDto> {
    if (projectId !== SKYSCOUT || ownerId !== ADA) {
      return Promise.reject(new NotFoundError("Project not found"));
    }
    return Promise.resolve(PROJECT);
  }
}

/** The errors a submission reported; fails the test if it was accepted. */
function errorsOf(result: ValidationResult): ValidationError[] {
  if (result.valid) throw new Error("expected the submission to be refused as invalid");
  return result.errors;
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<Error> {
  try {
    await call;
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("DefinitionsService", () => {
  let repository: InMemoryDefinitionsRepository;
  let service: DefinitionsService;

  beforeEach(async () => {
    repository = new InMemoryDefinitionsRepository();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefinitionsService,
        { provide: DefinitionsRepository, useValue: repository },
        { provide: ProjectsService, useValue: new OwnedProjects() },
      ],
    }).compile();

    service = moduleRef.get(DefinitionsService);
  });

  describe("submitDraft", () => {
    it("stores a valid definition with nothing left to report", async () => {
      const result = await service.submitDraft(ADA, SKYSCOUT, saasDefinition);

      expect(result.valid).toBe(true);
      await expect(service.getDraft(SKYSCOUT)).resolves.toEqual({
        payload: saasDefinition,
        valid: true,
        errors: null,
        updatedAt: expect.any(String),
      });
    });

    it("stores an invalid draft and answers with what was wrong with it", async () => {
      const reported = errorsOf(await service.submitDraft(ADA, SKYSCOUT, BROKEN));

      expect(reported.length).toBeGreaterThan(0);
      await expect(service.getValidationResult(SKYSCOUT)).resolves.toEqual({
        valid: false,
        errors: reported,
      });
    });

    it("keeps an invalid draft readable, so the agent can see what it sent", async () => {
      await service.submitDraft(ADA, SKYSCOUT, BROKEN);

      const draft = await service.getDraft(SKYSCOUT);

      expect(draft?.payload).toEqual(BROKEN);
      expect(draft?.valid).toBe(false);
    });

    it("stores every error exactly as validation wrote it", async () => {
      await service.submitDraft(ADA, SKYSCOUT, BROKEN);

      const stored = await service.getValidationResult(SKYSCOUT);

      // Same input, straight from contracts: what came out of storage must be
      // indistinguishable from what validation produced, hints and all.
      expect(stored?.errors).toEqual(errorsOf(validateDefinition(BROKEN)));
      for (const error of stored?.errors ?? []) {
        expect(Object.keys(error).sort()).toEqual(["expected", "hint", "message", "path"]);
      }
    });

    it("replaces the draft on resubmission rather than keeping both", async () => {
      await service.submitDraft(ADA, SKYSCOUT, BROKEN);
      await service.submitDraft(ADA, SKYSCOUT, saasDefinition);

      expect(repository.rows).toHaveLength(1);
      const draft = await service.getDraft(SKYSCOUT);
      expect(draft?.payload).toEqual(saasDefinition);
      expect(draft?.valid).toBe(true);
      // The repaired draft must not inherit the errors of the one it replaced.
      expect(draft?.errors).toBeNull();
    });

    it("refuses a payload too large to be a definition, and stores nothing", async () => {
      const oversize = { note: "x".repeat(MAX_PAYLOAD_BYTES) };

      const refusal = await refusalFrom(service.submitDraft(ADA, SKYSCOUT, oversize));

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect(repository.rows).toEqual([]);
    });

    it("answers a submission to someone else's project as missing, and stores nothing", async () => {
      const refusal = await refusalFrom(service.submitDraft(GRACE, SKYSCOUT, saasDefinition));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
    });
  });

  describe("getDraft", () => {
    it("answers a project that has never been submitted to with nothing", async () => {
      await expect(service.getDraft(SKYSCOUT)).resolves.toBeNull();
    });

    it("does not hand one project the draft of another", async () => {
      await service.submitDraft(ADA, SKYSCOUT, saasDefinition);

      await expect(service.getDraft("project-ledger")).resolves.toBeNull();
    });
  });

  describe("getValidationResult", () => {
    it("answers a project that has never been submitted to with nothing", async () => {
      await expect(service.getValidationResult(SKYSCOUT)).resolves.toBeNull();
    });

    it("answers without validating anything again", async () => {
      await service.submitDraft(ADA, SKYSCOUT, saasDefinition);

      await expect(service.getValidationResult(SKYSCOUT)).resolves.toEqual({
        valid: true,
        errors: null,
      });
    });
  });
});
