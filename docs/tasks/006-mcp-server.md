# Task 006 · MCP server — PLAN GATE

## Context
The MCP server is the product's authoring interface: a customer's coding
agent connects here to read project state and submit definitions. Tool names,
descriptions, and result shapes are PUBLIC CONTRACT — agents across the world
will be prompted against them, so they are designed once, carefully.
Read docs/DECISIONS.md #008 and #011 first.

PLAN GATE: before code, post (1) the exact tool list with input/output
schemas and descriptions, (2) the auth flow, (3) how validation errors are
rendered in tool results. Wait for approval.

## Scope
- Table: `agent_tokens` (id uuid pk, project_id fk, token_hash unique, label,
  created_at, last_used_at null). Migration included.
- Token minting: `POST /projects/:id/agent-tokens` (session auth, owner
  only) → plaintext token shown ONCE, format `rpk_<40 random base62>`.
  `GET /projects/:id/agent-tokens` lists label + created/last_used (no
  token). Stored hashed (sha256).
- MCP endpoint at `POST /mcp` using `@modelcontextprotocol/sdk` (streamable
  HTTP transport), authenticated via `Authorization: Bearer rpk_...`. A token
  scopes the session to exactly its project.
- Tools (final naming subject to the plan gate):
  - `get_project` — name, key, whether a connection exists, definition
    status (none | invalid | valid), updated_at.
  - `get_definition` — current draft payload (or explicit "no draft yet").
  - `submit_definition` — input: the definition object. Output: valid flag
    and, if invalid, the FULL error list, each error formatted as
    path + message + expected + hint so the agent can self-repair in one
    read. Never truncate errors.
  - `get_validation_result` — last stored result without resubmitting.
  - `get_schema_documentation` — returns the contracts SCHEMA.md content, so
    an agent can author without leaving the session.
- Tool descriptions are written FOR agents: state what the tool is for, when
  to call it, and what a good workflow looks like (inspect app → read schema
  docs → submit → repair until valid).
- Errors: bad/missing token → MCP-level auth error; oversized/invalid input
  surfaces the domain error message, never internals.

## Out of scope (binding)
Publish/preview tools (renderer doesn't exist yet — added in a later task),
token revocation UI, multi-project tokens, rate limiting, SSE legacy
transport, workspace administration, any SQL or data-access tools.

## Acceptance
- [ ] Specs: token auth (valid, invalid, revoked-by-deletion), each tool's
      happy path, submit→invalid returns full untruncated error list,
      last_used_at updates
- [ ] Manual check documented in the summary: connect a real MCP client
      (e.g. `claude mcp add --transport http`) and round-trip a definition
- [ ] Tool descriptions reviewed against #008 (do they teach self-repair?)

## Allowed dependencies
`@modelcontextprotocol/sdk`. Nothing else.
