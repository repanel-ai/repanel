import type { ProjectDto } from "@repanel/contracts";
import type { ProjectRow } from "./projects.repository";

/** The only way a project row leaves the API. The owner's id stays behind. */
export function toProjectDto(project: ProjectRow): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    key: project.key,
    createdAt: project.createdAt.toISOString(),
  };
}
