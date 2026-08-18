# Task 005 · Definitions (draft storage + validation)

## Context
The definitions feature stores a project's current draft and its validation
result. It is the service the MCP server (006) calls; it owns no transport of
its own yet. Validation itself lives in `@repanel/contracts` — this feature
orchestrates and persists, never re-implements.

## Scope
- Table: `definitions` (id uuid pk, project_id fk unique — exactly one draft
  per project in POC, payload jsonb, valid boolean, errors jsonb null,
  created_at, updated_at). Migration included.
- `definitions/` feature module (no controller yet):
  - `submitDraft(userOrAgentCtx, projectId, payload: unknown)`:
    runs `validateDefinition` from contracts, upserts the row with payload +
    valid flag + errors (invalid drafts ARE stored — the agent needs to read
    back what failed), returns the full ValidationResult.
  - `getDraft(projectId)` → payload + valid + errors + updated_at, or null.
  - `getValidationResult(projectId)` → the stored errors/valid.
- Payload size guard: reject > 1 MB with a ValidationFailedError before
  parsing (a definition should never be near this).
- Service is exported for 006 and 008 to consume.

## Out of scope (binding)
Publishing, versions/history, compilation/normalization step, HTTP endpoints,
diffing, per-resource partial updates.

## Acceptance
- [ ] Specs: valid submit stores valid=true/errors=null; invalid submit
      stores errors and returns them; resubmit replaces the single row;
      oversize payload rejected; getDraft on empty project → null
- [ ] The stored errors round-trip identically to what validateDefinition
      returned (path/message/expected/hint intact)

## Allowed dependencies
None new.
