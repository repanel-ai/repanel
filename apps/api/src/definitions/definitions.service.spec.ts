import { Test } from "@nestjs/testing";
import {
  validateDefinition,
  type ProjectDto,
  type ValidationError,
  type ValidationResult,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import type { Principal } from "../auth/principal";
import { ConfigService } from "../config/config.service";
import { NotFoundError, ValidationFailedError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { MAX_PAYLOAD_BYTES } from "./definition-size";
import {
  DefinitionsRepository,
  type DefinitionRow,
  type NewDefinitionRow,
} from "./definitions.repository";
import { DefinitionsService } from "./definitions.service";

const CREWBASE = "project-crewbase";
const LEDGER = "project-ledger";

/** Where this deployment serves the rendered admin. */
const RUNTIME_URL = "https://admin.repanel.test";

/** Ada owns Crewbase; Grace owns nothing here. */
const ADA: Principal = { kind: "user", userId: "user-ada" };
const GRACE: Principal = { kind: "user", userId: "user-grace" };
/** The agent holding Crewbase's token, and one holding another project's. */
const CREWBASE_AGENT: Principal = { kind: "agent", projectId: CREWBASE };
const LEDGER_AGENT: Principal = { kind: "agent", projectId: LEDGER };

const PROJECT: ProjectDto = {
  id: CREWBASE,
  name: "Crewbase",
  key: "crewbase-a3k9x2",
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

/**
 * Stands in for the projects feature: Ada owns Crewbase, and Crewbase's token
 * reaches Crewbase. Everything else is missing, whoever is asking.
 */
class ReachableProjects implements Pick<ProjectsService, "requireAccess"> {
  requireAccess(principal: Principal, projectId: string): Promise<ProjectDto> {
    const reaches =
      principal.kind === "user"
        ? principal.userId === "user-ada" && projectId === CREWBASE
        : principal.projectId === projectId && projectId === CREWBASE;

    if (!reaches) return Promise.reject(new NotFoundError("Project not found"));
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
        { provide: ProjectsService, useValue: new ReachableProjects() },
        { provide: ConfigService, useValue: { runtimeUrl: RUNTIME_URL } },
      ],
    }).compile();

    service = moduleRef.get(DefinitionsService);
  });

  describe("submitDraft", () => {
    it("stores a valid definition with nothing left to report", async () => {
      const result = await service.submitDraft(ADA, CREWBASE, saasDefinition);

      expect(result.valid).toBe(true);
      await expect(service.getDraft(ADA, CREWBASE)).resolves.toEqual({
        payload: saasDefinition,
        valid: true,
        errors: null,
        updatedAt: expect.any(String),
      });
    });

    it("stores an invalid draft and answers with what was wrong with it", async () => {
      const reported = errorsOf(await service.submitDraft(ADA, CREWBASE, BROKEN));

      expect(reported.length).toBeGreaterThan(0);
      await expect(service.getValidationResult(ADA, CREWBASE)).resolves.toEqual({
        valid: false,
        errors: reported,
        updatedAt: expect.any(String),
      });
    });

    it("keeps an invalid draft readable, so the agent can see what it sent", async () => {
      await service.submitDraft(ADA, CREWBASE, BROKEN);

      const draft = await service.getDraft(ADA, CREWBASE);

      expect(draft?.payload).toEqual(BROKEN);
      expect(draft?.valid).toBe(false);
    });

    it("stores every error exactly as validation wrote it", async () => {
      await service.submitDraft(ADA, CREWBASE, BROKEN);

      const stored = await service.getValidationResult(ADA, CREWBASE);

      // Same input, straight from contracts: what came out of storage must be
      // indistinguishable from what validation produced, hints and all.
      expect(stored?.errors).toEqual(errorsOf(validateDefinition(BROKEN)));
      for (const error of stored?.errors ?? []) {
        expect(Object.keys(error).sort()).toEqual(["expected", "hint", "message", "path"]);
      }
    });

    it("replaces the draft on resubmission rather than keeping both", async () => {
      await service.submitDraft(ADA, CREWBASE, BROKEN);
      await service.submitDraft(ADA, CREWBASE, saasDefinition);

      expect(repository.rows).toHaveLength(1);
      const draft = await service.getDraft(ADA, CREWBASE);
      expect(draft?.payload).toEqual(saasDefinition);
      expect(draft?.valid).toBe(true);
      // The repaired draft must not inherit the errors of the one it replaced.
      expect(draft?.errors).toBeNull();
    });

    it("refuses a payload too large to be a definition, and stores nothing", async () => {
      const oversize = { note: "x".repeat(MAX_PAYLOAD_BYTES) };

      const refusal = await refusalFrom(service.submitDraft(ADA, CREWBASE, oversize));

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect(repository.rows).toEqual([]);
    });

    it("answers a submission to someone else's project as missing, and stores nothing", async () => {
      const refusal = await refusalFrom(service.submitDraft(GRACE, CREWBASE, saasDefinition));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
    });

    it("takes a submission from the agent holding the project's own token", async () => {
      const result = await service.submitDraft(CREWBASE_AGENT, CREWBASE, saasDefinition);

      expect(result.valid).toBe(true);
      expect(repository.rows).toHaveLength(1);
    });

    it("answers an agent submitting to a project its token does not name as missing", async () => {
      const refusal = await refusalFrom(
        service.submitDraft(LEDGER_AGENT, CREWBASE, saasDefinition),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
    });
  });

  describe("submit", () => {
    it("stores the definition and says where the admin it describes is served", async () => {
      await expect(service.submit("user-ada", CREWBASE, saasDefinition)).resolves.toEqual({
        valid: true,
        adminUrl: `${RUNTIME_URL}/a/${PROJECT.key}`,
      });
      expect(repository.rows).toHaveLength(1);
    });

    it("answers an invalid definition with the work list, and stores it anyway", async () => {
      const verdict = await service.submit("user-ada", CREWBASE, BROKEN);

      expect(verdict).toEqual({ valid: false, errors: errorsOf(validateDefinition(BROKEN)) });
      expect(repository.rows).toHaveLength(1);
      expect(repository.rows[0]?.valid).toBe(false);
    });

    it("answers a submission to someone else's project as missing, and stores nothing", async () => {
      const refusal = await refusalFrom(service.submit("user-grace", CREWBASE, saasDefinition));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
    });
  });

  describe("getDraft", () => {
    it("answers a project that has never been submitted to with nothing", async () => {
      await expect(service.getDraft(ADA, CREWBASE)).resolves.toBeNull();
    });

    it("hands the agent holding the project's token the draft that was submitted", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition);

      const draft = await service.getDraft(CREWBASE_AGENT, CREWBASE);

      expect(draft?.payload).toEqual(saasDefinition);
    });

    it("refuses a project the caller cannot reach rather than reading it", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition);

      await expect(refusalFrom(service.getDraft(LEDGER_AGENT, CREWBASE))).resolves.toBeInstanceOf(
        NotFoundError,
      );
      await expect(refusalFrom(service.getDraft(GRACE, CREWBASE))).resolves.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("getValidationResult", () => {
    it("answers a project that has never been submitted to with nothing", async () => {
      await expect(service.getValidationResult(ADA, CREWBASE)).resolves.toBeNull();
    });

    it("answers without validating anything again", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition);

      await expect(service.getValidationResult(ADA, CREWBASE)).resolves.toEqual({
        valid: true,
        errors: null,
        updatedAt: expect.any(String),
      });
    });

    it("refuses a project the caller cannot reach", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition);

      const refusal = await refusalFrom(service.getValidationResult(LEDGER_AGENT, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("status", () => {
    it("says a project nobody has submitted to has no definition", async () => {
      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({ status: "none" });
    });

    it("says when a valid definition was submitted", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition);

      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({
        status: "valid",
        updatedAt: expect.any(String),
      });
    });

    it("hands an invalid definition's problems to the human who has to read them", async () => {
      const reported = errorsOf(await service.submitDraft(ADA, CREWBASE, BROKEN));

      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({
        status: "invalid",
        errorCount: reported.length,
        errors: reported,
      });
    });

    it("refuses a project the caller does not own", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition);

      const refusal = await refusalFrom(service.status("user-grace", CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });
});
