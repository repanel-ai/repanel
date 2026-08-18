import { z } from "zod";

/** What `POST /projects/:projectId/agent-tokens` accepts. The token is minted, never supplied. */
export const createAgentTokenRequestSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "must not be empty")
    .max(100, "must be at most 100 characters"),
});

export type CreateAgentTokenRequest = z.infer<typeof createAgentTokenRequestSchema>;
