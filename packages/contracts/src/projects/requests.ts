import { z } from "zod";

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
