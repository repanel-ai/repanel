import { z } from "zod";
import { emailField } from "../auth/requests.js";

const nameField = z
  .string()
  .trim()
  .min(1, "must not be empty")
  .max(100, "must be at most 100 characters");

/** What `POST /projects` accepts. The key is derived, never supplied. */
export const createProjectRequestSchema = z.object({
  name: nameField,
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

/**
 * What `POST /projects/:projectId/people` accepts. The role is not in here:
 * this route adds operators, and an owner is made by creating a project.
 *
 * The name is only used when the address is new to RePanel — a person who
 * already has an account keeps the name they gave it, because it is theirs and
 * not the owner's to write.
 */
export const addOperatorRequestSchema = z.object({
  email: emailField,
  name: nameField,
});

export type AddOperatorRequest = z.infer<typeof addOperatorRequestSchema>;
