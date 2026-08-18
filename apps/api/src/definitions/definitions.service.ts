import { Injectable } from "@nestjs/common";
import { validateDefinition, type ValidationResult } from "@repanel/contracts";
import { ProjectsService } from "../projects/projects.service";
import { requirePayloadWithinLimit } from "./definition-size";
import {
  toDefinitionDraft,
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
  ) {}

  /**
   * Validates a submission and files it as the project's one draft. An
   * invalid draft is stored too: the agent that submitted it has to be able
   * to read back what it sent alongside what was wrong with it.
   */
  async submitDraft(
    ownerId: string,
    projectId: string,
    payload: unknown,
  ): Promise<ValidationResult> {
    await this.projects.requireOwned(projectId, ownerId);
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

  /** The project's draft as it stands, or null if nothing was ever submitted. */
  async getDraft(projectId: string): Promise<DefinitionDraft | null> {
    const definition = await this.repository.findByProjectId(projectId);
    return definition ? toDefinitionDraft(definition) : null;
  }

  /** What the last submission concluded, without validating anything again. */
  async getValidationResult(projectId: string): Promise<StoredValidation | null> {
    const definition = await this.repository.findByProjectId(projectId);
    return definition ? toStoredValidation(definition) : null;
  }
}
