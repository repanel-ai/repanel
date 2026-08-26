import type { ProjectDto, ProjectMembershipDto } from "@repanel/contracts";
import type { MembershipRow, ProjectRow } from "./projects.repository";

/** The only way a project row leaves the API. The owner's id stays behind. */
export function toProjectDto(project: ProjectRow): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    key: project.key,
    createdAt: project.createdAt.toISOString(),
  };
}

/**
 * A project together with what the person who asked may do there. The role is
 * beside the project rather than inside it: the same project is one person's to
 * configure and another's to work in, so it is not a fact the project carries.
 */
export function toProjectMembershipDto(membership: MembershipRow): ProjectMembershipDto {
  return { project: toProjectDto(membership.project), role: membership.role };
}
