import { Injectable } from "@nestjs/common";
import type { CreateProjectRequest, ProjectDto } from "@repanel/contracts";
import { ConflictError, NotFoundError } from "../errors/domain-errors";
import { createProjectKey } from "./project-key";
import { toProjectDto } from "./projects.mapper";
import { ProjectsRepository } from "./projects.repository";

/**
 * How many keys to draw before giving up. Two draws collide once in 36^6, so
 * a third attempt is already generosity; an unbounded loop would not be.
 */
const KEY_ATTEMPTS = 3;

@Injectable()
export class ProjectsService {
  constructor(private readonly repository: ProjectsRepository) {}

  async create(ownerId: string, { name }: CreateProjectRequest): Promise<ProjectDto> {
    for (let attempt = 0; attempt < KEY_ATTEMPTS; attempt += 1) {
      try {
        const key = createProjectKey(name);
        return toProjectDto(await this.repository.create({ userId: ownerId, name, key }));
      } catch (error) {
        // The key is all that can conflict, and a fresh suffix is the remedy.
        if (!(error instanceof ConflictError)) throw error;
      }
    }

    throw new ConflictError("Could not find a free project key");
  }

  async list(ownerId: string): Promise<ProjectDto[]> {
    const owned = await this.repository.listByOwner(ownerId);
    return owned.map(toProjectDto);
  }

  /**
   * The project, if it belongs to this user. Someone else's reads as missing:
   * a refusal would confirm that the id names something real.
   */
  async requireOwned(projectId: string, ownerId: string): Promise<ProjectDto> {
    const project = await this.repository.findById(projectId);
    if (!project || project.userId !== ownerId) throw new NotFoundError("Project not found");
    return toProjectDto(project);
  }
}
