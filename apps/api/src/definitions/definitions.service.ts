import { Injectable } from "@nestjs/common";
import {
  validateDefinition,
  type DefinitionStatusDto,
  type DefinitionSubmissionDto,
  type PublishedDefinitionDto,
  type ValidationResult,
} from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import { ConfigService } from "../config/config.service";
import { ConnectorSocketsService } from "../connector-sockets/connector-sockets.service";
import { NotFoundError, ValidationFailedError } from "../errors/domain-errors";
import { ProjectsService } from "../projects/projects.service";
import { requirePayloadWithinLimit } from "./definition-size";
import { DefinitionVersionsRepository } from "./definition-versions.repository";
import {
  toDefinitionDraft,
  toDefinitionStatus,
  toPublishedDefinition,
  toStoredValidation,
  type DefinitionDraft,
  type PublishedDefinition,
  type StoredValidation,
} from "./definitions.mapper";
import { DefinitionsRepository } from "./definitions.repository";

/**
 * What became of a submission. Three outcomes, said as three words, because
 * "valid" alone stopped being the whole answer once a valid definition could be
 * either live or waiting: `published` reached the operators, `held` was stored
 * at the submitter's request, `invalid` did not validate and changed nothing an
 * operator can see.
 */
export type SubmissionOutcome = "published" | "held" | "invalid";

/** A submission's verdict, and what happened to the definition it carried. */
export interface DraftSubmission {
  result: ValidationResult;
  outcome: SubmissionOutcome;
  /** The version this submission became, or null when nothing was published. */
  version: number | null;
}

/** Whether a submission that validates should go live, said by the caller. */
export interface SubmitOptions {
  publish: boolean;
}

const NOTHING_TO_PUBLISH = "This project has no definition to publish";
const NOT_VALIDATED = "This definition has not validated";

/**
 * Owns a project's definition: the one draft that is written to, and the
 * versions that were published from it. Validation itself belongs to
 * `@repanel/contracts` — this feature decides who may submit, what is kept, and
 * what operators are served, never what is legal.
 */
@Injectable()
export class DefinitionsService {
  constructor(
    private readonly repository: DefinitionsRepository,
    private readonly versions: DefinitionVersionsRepository,
    private readonly projects: ProjectsService,
    private readonly config: ConfigService,
    private readonly connectors: ConnectorSocketsService,
  ) {}

  /**
   * Validates a submission, files it as the project's one draft, and — when it
   * validates and the caller asked for it — publishes it.
   *
   * An invalid draft is stored too: the agent that submitted it has to be able
   * to read back what it sent alongside what was wrong with it. It is never
   * published, so a submission that does not validate cannot take an admin
   * down; that is the whole reason a draft and a version are two things.
   */
  async submitDraft(
    principal: Principal,
    projectId: string,
    payload: unknown,
    options: SubmitOptions,
  ): Promise<DraftSubmission> {
    await this.projects.requireAccess(principal, projectId, "owner");
    requirePayloadWithinLimit(payload);

    const result = validateDefinition(payload);
    await this.repository.save({
      projectId,
      payload,
      valid: result.valid,
      errors: result.valid ? null : result.errors,
    });

    if (!result.valid) return { result, outcome: "invalid", version: null };
    if (!options.publish) return { result, outcome: "held", version: null };

    // Stored first and published second, in that order and without a
    // transaction around them: if publishing is refused, the draft that was
    // accepted stays readable rather than being rolled back out from under the
    // agent that submitted it.
    const published = await this.publishPayload(projectId, payload);
    return { result, outcome: "published", version: published.version };
  }

  /**
   * The same submission, made by the human at a command line rather than by
   * the agent that wrote the definition. What comes back is the verdict and
   * where to open the admin — a terminal has no console page to send anyone to.
   */
  async submit(
    ownerId: string,
    projectId: string,
    payload: unknown,
  ): Promise<DefinitionSubmissionDto> {
    const principal: Principal = { kind: "user", userId: ownerId };
    // A deploy is a human asking for their definition to be live, which is what
    // it has always meant: the address this answers with has to be serving it.
    const { result } = await this.submitDraft(principal, projectId, payload, { publish: true });
    if (!result.valid) return { valid: false, errors: result.errors };

    const project = await this.projects.requireAccess(principal, projectId, "owner");
    return { valid: true, adminUrl: `${this.config.runtimeUrl}/a/${project.key}` };
  }

  /**
   * Publishes the draft as it stands, for the human who decided it should be
   * live. Only a draft that validates can be published: what the runtime is
   * given has to be something the runtime can render.
   */
  async publish(ownerId: string, projectId: string): Promise<PublishedDefinitionDto> {
    const principal: Principal = { kind: "user", userId: ownerId };
    await this.projects.requireAccess(principal, projectId, "owner");

    const draft = await this.repository.findByProjectId(projectId);
    if (!draft) throw new NotFoundError(NOTHING_TO_PUBLISH);
    if (!draft.valid) throw new ValidationFailedError(NOT_VALIDATED, draft.errors ?? []);

    const { version, publishedAt } = await this.publishPayload(projectId, draft.payload);
    return { version, publishedAt };
  }

  /** The project's draft as it stands, or null if nothing was ever submitted. */
  async getDraft(principal: Principal, projectId: string): Promise<DefinitionDraft | null> {
    await this.projects.requireAccess(principal, projectId, "owner");

    const definition = await this.repository.findByProjectId(projectId);
    return definition ? toDefinitionDraft(definition) : null;
  }

  /**
   * The version the admin serves, or null while nothing has been published.
   * `operator`, and it is the only definition route that is: what an operator
   * may see is the admin they were put on a project to use.
   */
  async getPublished(
    principal: Principal,
    projectId: string,
  ): Promise<PublishedDefinition | null> {
    await this.projects.requireAccess(principal, projectId, "operator");

    const published = await this.versions.findLatest(projectId);
    return published ? toPublishedDefinition(published) : null;
  }

  /**
   * Where the definition stands, shaped for the console. The owner is named
   * rather than a principal because only a human ever asks this: an agent has
   * richer tools.
   */
  async status(ownerId: string, projectId: string): Promise<DefinitionStatusDto> {
    await this.projects.requireAccess({ kind: "user", userId: ownerId }, projectId, "owner");

    const definition = await this.repository.findByProjectId(projectId);
    const published = await this.versions.findLatest(projectId);

    return toDefinitionStatus(
      definition ? toStoredValidation(definition) : null,
      published ? toPublishedDefinition(published) : null,
    );
  }

  /**
   * What the last submission concluded, without validating anything again.
   * `operator`, because the runtime asks it on an operator's behalf to say why
   * there is nothing to serve — a blank admin has to be able to explain itself.
   */
  async getValidationResult(
    principal: Principal,
    projectId: string,
  ): Promise<StoredValidation | null> {
    await this.projects.requireAccess(principal, projectId, "operator");

    const definition = await this.repository.findByProjectId(projectId);
    return definition ? toStoredValidation(definition) : null;
  }

  /**
   * Copies a payload into a version of its own. Called with the payload that
   * was just validated rather than a re-read of the row, so what goes live is
   * demonstrably the thing that passed validation.
   */
  private async publishPayload(projectId: string, payload: unknown): Promise<PublishedDefinition> {
    const published = toPublishedDefinition(await this.versions.insertNext(projectId, payload));

    // A connector serves the definition it holds, so it is told the moment
    // there is a newer one. Told rather than sent: it pulls for itself, over
    // the channel it authenticated on. Nothing is lost when nobody is
    // listening — a connector pulls as its session opens, so the next one to
    // connect is current by construction (DECISIONS #064).
    this.connectors.notify(projectId, { kind: "definitionPublished", version: published.version });

    return published;
  }
}
