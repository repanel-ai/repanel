import type { ProjectRole } from "./membership.js";

/** Somebody who may reach a project, as the console's People page lists them. */
export interface PersonDto {
  userId: string;
  email: string;
  name: string;
  role: ProjectRole;
  /** ISO 8601: a DTO carries no `Date`, so browser and Node read it alike. */
  addedAt: string;
}

/**
 * The answer to adding an operator, and the only place their password appears.
 * Only its hash is stored, so this response is the only copy that will ever
 * exist — and it is null when the address already had a RePanel account, which
 * is how the owner knows there is nothing to pass on.
 */
export interface AddedPersonDto {
  person: PersonDto;
  password: string | null;
}
