import { Injectable } from "@nestjs/common";
import {
  validateDefinition,
  type DefinitionStatusDto,
  type DefinitionSubmissionDto,
  type ValidationResult,
} from "@repanel/contracts";
import type { Principal } from "../auth/principal";
import { ConfigService } from "../config/config.service";
import { ProjectsService } from "../projects/projects.service";
import { requirePayloadWithinLimit } from "./definition-size";
import {
  toDefinitionDraft,
  toDefinitionStatus,
  toStoredValidation,
  type DefinitionDraft,
  type StoredValidation,
} from "./definitions.mapper";
import { DefinitionsRepository } from "./definitions.repository";

/**
 * Owns a project's draft definition: what was submitted and how it fared.
 * Validation itself belongs to `@repanel/contracts` — this feature decides
 * who may submit, and what is kept, never what is legal.
 */
@Injectable()
export class DefinitionsService {
  constructor(
    private readonly repository: DefinitionsRepository,
    private readonly projects: ProjectsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Validates a submission and files it as the project's one draft. An
   * invalid draft is stored too: the agent that submitted it has to be able
   * to read back what it sent alongside what was wrong with it.
   */
  async submitDraft(
    principal: Principal,
    projectId: string,
    payload: unknown,
  ): Promise<ValidationResult> {
    await this.projects.requireAccess(principal, projectId);
    requirePayloadWithinLimit(payload);

    const result = validateDefinition(payload);
    await this.repository.save({
      projectId,
      payload,
      valid: result.valid,
      errors: result.valid ? null : result.errors,
    });

    return result;
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
    const result = await this.submitDraft(principal, projectId, payload);
    if (!result.valid) return { valid: false, errors: result.errors };

    const project = await this.projects.requireAccess(principal, projectId);
    return { valid: true, adminUrl: `${this.config.runtimeUrl}/a/${project.key}` };
  }

  /** The project's draft as it stands, or null if nothing was ever submitted. */
  async getDraft(principal: Principal, projectId: string): Promise<DefinitionDraft | null> {
    await this.projects.requireAccess(principal, projectId);

    const definition = await this.repository.findByProjectId(projectId);
    return definition ? toDefinitionDraft(definition) : null;
  }

  /**
   * The same verdict, shaped for the console. The owner is named rather than a
   * principal because only a human ever asks this: an agent has richer tools.
   */
  async status(ownerId: string, projectId: string): Promise<DefinitionStatusDto> {
    const stored = await this.getValidationResult({ kind: "user", userId: ownerId }, projectId);

    return toDefinitionStatus(stored);
  }

  /** What the last submission concluded, without validating anything again. */
  async getValidationResult(
    principal: Principal,
    projectId: string,
  ): Promise<StoredValidation | null> {
    await this.projects.requireAccess(principal, projectId);

    const definition = await this.repository.findByProjectId(projectId);
    return definition ? toStoredValidation(definition) : null;
  }
}
