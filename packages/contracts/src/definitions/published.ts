/**
 * The definition an admin is actually serving. Publishing copies the draft
 * rather than pointing at it, so this is a version of its own: whatever the
 * agent submits next, what an operator is looking at right now is this.
 *
 * The payload is not here. A human asks which version is live and when it went
 * live; the definition itself is the agent's to read, through MCP.
 */
export interface PublishedDefinitionDto {
  /** 1 for a project's first publication, and one more for each after it. */
  version: number;
  /** ISO 8601: when this version became the one the admin serves. */
  publishedAt: string;
}
