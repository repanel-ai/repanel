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
  DefinitionVersionsRepository,
  type DefinitionVersionRow,
} from "./definition-versions.repository";
import {
  DefinitionsRepository,
  type DefinitionRow,
  type NewDefinitionRow,
} from "./definitions.repository";
import { DefinitionsService, type SubmitOptions } from "./definitions.service";

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

/** A second valid definition, told apart from the first by the app's name. */
const RENAMED = { ...saasDefinition, app: { name: "Renamed Admin" } };

/** What a submission asks for, said out loud at every call site. */
const PUBLISH: SubmitOptions = { publish: true };
const HOLD: SubmitOptions = { publish: false };

/**
 * A clock that only ever goes forwards. Postgres stamps these rows from its own
 * clock and two writes are never the same instant; a fake that reused one would
 * make "submitted after it was published" a coin toss.
 */
let clock = Date.parse("2026-08-19T09:00:00.000Z");
function tick(): Date {
  clock += 1_000;
  return new Date(clock);
}

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
      createdAt: previous?.createdAt ?? tick(),
      updatedAt: tick(),
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

/** Stands in for the versions table, including that nothing rewrites a row. */
class InMemoryDefinitionVersionsRepository
  implements Pick<DefinitionVersionsRepository, "insertNext" | "findLatest">
{
  readonly rows: DefinitionVersionRow[] = [];

  insertNext(projectId: string, payload: unknown): Promise<DefinitionVersionRow> {
    const published: DefinitionVersionRow = {
      id: `version-${this.rows.length + 1}`,
      projectId,
      version: this.rows.filter((row) => row.projectId === projectId).length + 1,
      payload: throughJsonb(payload),
      publishedAt: tick(),
    };

    this.rows.push(published);
    return Promise.resolve(published);
  }

  findLatest(projectId: string): Promise<DefinitionVersionRow | undefined> {
    return Promise.resolve(
      this.rows
        .filter((row) => row.projectId === projectId)
        .sort((a, b) => b.version - a.version)[0],
    );
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
  let versions: InMemoryDefinitionVersionsRepository;
  let service: DefinitionsService;

  beforeEach(async () => {
    repository = new InMemoryDefinitionsRepository();
    versions = new InMemoryDefinitionVersionsRepository();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DefinitionsService,
        { provide: DefinitionsRepository, useValue: repository },
        { provide: DefinitionVersionsRepository, useValue: versions },
        { provide: ProjectsService, useValue: new ReachableProjects() },
        { provide: ConfigService, useValue: { runtimeUrl: RUNTIME_URL } },
      ],
    }).compile();

    service = moduleRef.get(DefinitionsService);
  });

  describe("submitDraft", () => {
    it("stores a valid definition with nothing left to report", async () => {
      const { result, outcome } = await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      expect(result.valid).toBe(true);
      expect(outcome).toBe("held");
      await expect(service.getDraft(ADA, CREWBASE)).resolves.toEqual({
        payload: saasDefinition,
        valid: true,
        errors: null,
        updatedAt: expect.any(String),
      });
    });

    it("stores an invalid draft and answers with what was wrong with it", async () => {
      const submission = await service.submitDraft(ADA, CREWBASE, BROKEN, PUBLISH);
      const reported = errorsOf(submission.result);

      expect(reported.length).toBeGreaterThan(0);
      expect(submission.outcome).toBe("invalid");
      await expect(service.getValidationResult(ADA, CREWBASE)).resolves.toEqual({
        valid: false,
        errors: reported,
        updatedAt: expect.any(String),
      });
    });

    it("keeps an invalid draft readable, so the agent can see what it sent", async () => {
      await service.submitDraft(ADA, CREWBASE, BROKEN, PUBLISH);

      const draft = await service.getDraft(ADA, CREWBASE);

      expect(draft?.payload).toEqual(BROKEN);
      expect(draft?.valid).toBe(false);
    });

    it("stores every error exactly as validation wrote it", async () => {
      await service.submitDraft(ADA, CREWBASE, BROKEN, HOLD);

      const stored = await service.getValidationResult(ADA, CREWBASE);

      // Same input, straight from contracts: what came out of storage must be
      // indistinguishable from what validation produced, hints and all.
      expect(stored?.errors).toEqual(errorsOf(validateDefinition(BROKEN)));
      for (const error of stored?.errors ?? []) {
        expect(Object.keys(error).sort()).toEqual(["expected", "hint", "message", "path"]);
      }
    });

    it("replaces the draft on resubmission rather than keeping both", async () => {
      await service.submitDraft(ADA, CREWBASE, BROKEN, HOLD);
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      expect(repository.rows).toHaveLength(1);
      const draft = await service.getDraft(ADA, CREWBASE);
      expect(draft?.payload).toEqual(saasDefinition);
      expect(draft?.valid).toBe(true);
      // The repaired draft must not inherit the errors of the one it replaced.
      expect(draft?.errors).toBeNull();
    });

    it("refuses a payload too large to be a definition, and stores nothing", async () => {
      const oversize = { note: "x".repeat(MAX_PAYLOAD_BYTES) };

      const refusal = await refusalFrom(service.submitDraft(ADA, CREWBASE, oversize, PUBLISH));

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect(repository.rows).toEqual([]);
    });

    it("answers a submission to someone else's project as missing, and stores nothing", async () => {
      const refusal = await refusalFrom(
        service.submitDraft(GRACE, CREWBASE, saasDefinition, PUBLISH),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
      expect(versions.rows).toEqual([]);
    });

    it("takes a submission from the agent holding the project's own token", async () => {
      const { result } = await service.submitDraft(
        CREWBASE_AGENT,
        CREWBASE,
        saasDefinition,
        PUBLISH,
      );

      expect(result.valid).toBe(true);
      expect(repository.rows).toHaveLength(1);
    });

    it("answers an agent submitting to a project its token does not name as missing", async () => {
      const refusal = await refusalFrom(
        service.submitDraft(LEDGER_AGENT, CREWBASE, saasDefinition, PUBLISH),
      );

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(repository.rows).toEqual([]);
      expect(versions.rows).toEqual([]);
    });
  });

  describe("submit", () => {
    it("publishes the definition and says where the admin it describes is served", async () => {
      await expect(service.submit("user-ada", CREWBASE, saasDefinition)).resolves.toEqual({
        valid: true,
        adminUrl: `${RUNTIME_URL}/a/${PROJECT.key}`,
      });
      expect(repository.rows).toHaveLength(1);
      // The address it answers with has to be serving something: a deploy that
      // only filed a draft would be sending a human to an admin that is not up.
      expect(versions.rows).toHaveLength(1);
    });

    it("answers an invalid definition with the work list, stores it, publishes nothing", async () => {
      const verdict = await service.submit("user-ada", CREWBASE, BROKEN);

      expect(verdict).toEqual({ valid: false, errors: errorsOf(validateDefinition(BROKEN)) });
      expect(repository.rows).toHaveLength(1);
      expect(repository.rows[0]?.valid).toBe(false);
      expect(versions.rows).toEqual([]);
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
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      const draft = await service.getDraft(CREWBASE_AGENT, CREWBASE);

      expect(draft?.payload).toEqual(saasDefinition);
    });

    it("refuses a project the caller cannot reach rather than reading it", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

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
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      await expect(service.getValidationResult(ADA, CREWBASE)).resolves.toEqual({
        valid: true,
        errors: null,
        updatedAt: expect.any(String),
      });
    });

    it("refuses a project the caller cannot reach", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      const refusal = await refusalFrom(service.getValidationResult(LEDGER_AGENT, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("status", () => {
    it("says a project nobody has submitted to has neither a draft nor a version", async () => {
      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({
        draft: { status: "none" },
        published: null,
        unpublishedChanges: false,
      });
    });

    it("says a valid draft nobody has published is something to publish", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({
        draft: { status: "valid", updatedAt: expect.any(String) },
        published: null,
        unpublishedChanges: true,
      });
    });

    it("says a definition it has just published is not ahead of itself", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);

      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({
        draft: { status: "valid", updatedAt: expect.any(String) },
        published: { version: 1, publishedAt: expect.any(String) },
        unpublishedChanges: false,
      });
    });

    it("says when the draft has moved since the version being served", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);
      await service.submitDraft(ADA, CREWBASE, RENAMED, HOLD);

      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({
        draft: { status: "valid", updatedAt: expect.any(String) },
        published: { version: 1, publishedAt: expect.any(String) },
        unpublishedChanges: true,
      });
    });

    it("hands an invalid definition's problems to the human who has to read them", async () => {
      const reported = errorsOf((await service.submitDraft(ADA, CREWBASE, BROKEN, HOLD)).result);

      await expect(service.status("user-ada", CREWBASE)).resolves.toEqual({
        draft: { status: "invalid", errorCount: reported.length, errors: reported },
        published: null,
        unpublishedChanges: true,
      });
    });

    it("keeps reporting the live version while the draft that replaced it is broken", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);
      await service.submitDraft(ADA, CREWBASE, BROKEN, PUBLISH);

      const status = await service.status("user-ada", CREWBASE);

      expect(status.draft.status).toBe("invalid");
      expect(status.published).toEqual({ version: 1, publishedAt: expect.any(String) });
    });

    it("refuses a project the caller does not own", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      const refusal = await refusalFrom(service.status("user-grace", CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });

  describe("publishing", () => {
    it("makes a valid submission the version the admin serves", async () => {
      const submission = await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);

      expect(submission).toEqual({
        result: { valid: true, definition: expect.any(Object) },
        outcome: "published",
        version: 1,
      });
      const published = await service.getPublished(ADA, CREWBASE);
      expect(published).toEqual({
        version: 1,
        publishedAt: expect.any(String),
        payload: saasDefinition,
      });
    });

    it("holds a valid submission the submitter asked not to publish", async () => {
      const submission = await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      expect(submission.outcome).toBe("held");
      expect(submission.version).toBeNull();
      await expect(service.getPublished(ADA, CREWBASE)).resolves.toBeNull();
      expect(versions.rows).toEqual([]);
    });

    it("numbers each publication after the one before it", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);
      const second = await service.submitDraft(ADA, CREWBASE, RENAMED, PUBLISH);

      expect(second.version).toBe(2);
      expect(versions.rows.map((row) => row.version)).toEqual([1, 2]);
      const published = await service.getPublished(ADA, CREWBASE);
      expect(published?.payload).toEqual(RENAMED);
    });

    it("publishes the stored draft when a human says so", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      await expect(service.publish("user-ada", CREWBASE)).resolves.toEqual({
        version: 1,
        publishedAt: expect.any(String),
      });
      const published = await service.getPublished(ADA, CREWBASE);
      expect(published?.payload).toEqual(saasDefinition);
    });

    it("refuses to publish a draft that did not validate, with its problems", async () => {
      const reported = errorsOf((await service.submitDraft(ADA, CREWBASE, BROKEN, HOLD)).result);

      const refusal = await refusalFrom(service.publish("user-ada", CREWBASE));

      expect(refusal).toBeInstanceOf(ValidationFailedError);
      expect((refusal as ValidationFailedError).details).toEqual(reported);
      expect(versions.rows).toEqual([]);
    });

    it("refuses to publish a project with nothing submitted to it", async () => {
      const refusal = await refusalFrom(service.publish("user-ada", CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(versions.rows).toEqual([]);
    });

    it("refuses to publish someone else's project", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      const refusal = await refusalFrom(service.publish("user-grace", CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
      expect(versions.rows).toEqual([]);
    });

    /**
     * The transcript this whole feature comes from: an agent resubmits, the
     * submission does not validate, and the admin somebody is working in goes
     * down. It cannot any more — the draft is what was replaced.
     */
    it("keeps serving the published version when an invalid draft lands over it", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);

      const submission = await service.submitDraft(ADA, CREWBASE, BROKEN, PUBLISH);

      expect(submission.outcome).toBe("invalid");
      expect(submission.version).toBeNull();
      expect(versions.rows).toHaveLength(1);
      const published = await service.getPublished(ADA, CREWBASE);
      expect(published).toEqual({
        version: 1,
        publishedAt: expect.any(String),
        payload: saasDefinition,
      });
      // And the failing draft is readable, which is the other half of the deal.
      const draft = await service.getDraft(ADA, CREWBASE);
      expect(draft?.payload).toEqual(BROKEN);
      expect(draft?.errors).toEqual(errorsOf(validateDefinition(BROKEN)));
    });

    /**
     * Publishing copies. Nothing an agent does to the draft afterwards — valid
     * or not — reaches the copy, because there is no path from one to the other
     * except publishing again.
     */
    it("does not let a later draft reach the version already published", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);

      await service.submitDraft(ADA, CREWBASE, RENAMED, HOLD);

      const published = await service.getPublished(ADA, CREWBASE);
      expect(published?.version).toBe(1);
      expect(published?.payload).toEqual(saasDefinition);
      expect(versions.rows).toHaveLength(1);
    });

    it("answers a project with nothing published with nothing", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, HOLD);

      await expect(service.getPublished(ADA, CREWBASE)).resolves.toBeNull();
    });

    it("refuses to read the published version of a project the caller cannot reach", async () => {
      await service.submitDraft(ADA, CREWBASE, saasDefinition, PUBLISH);

      const refusal = await refusalFrom(service.getPublished(LEDGER_AGENT, CREWBASE));

      expect(refusal).toBeInstanceOf(NotFoundError);
    });
  });
});
