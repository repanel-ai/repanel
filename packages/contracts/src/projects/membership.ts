import type { ProjectDto } from "./project.js";

/**
 * What a person may do with a project. Two roles and no more: an `owner`
 * configures RePanel — the connection, the agent's tokens, what is published —
 * and an `operator` uses the admin that comes out of it. Everything finer than
 * that is a permission system, and this is deliberately not one.
 */
export const PROJECT_ROLES = ["owner", "operator"] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

/**
 * A project as somebody who may reach it sees it, with what they may do there.
 * The role belongs on the membership rather than on the project: it is a fact
 * about this pairing, and the same project is owned by one person and operated
 * by another.
 */
export interface ProjectMembershipDto {
  project: ProjectDto;
  role: ProjectRole;
}
