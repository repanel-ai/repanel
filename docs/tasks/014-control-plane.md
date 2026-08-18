# Task 014 · Control plane (minimal)

## Context
The last mile: a developer sets up a project without curl. Deliberately
modest — the runtime is the product's face; the control plane just needs to
be clear, honest, and unembarrassing. Reuse the 010 token plan at lower
density; no new design language.

## Scope
### API (small additions)
- `GET /projects/:id/definition/status` → none | invalid (error count +
  errors) | valid (+ updated_at) — thin controller over DefinitionsService.
- `GET /projects/:id/connection` → the display DTO from 007 (or null).

### Web
- `/` project list: cards (name, key, definition status chip), create
  dialog (name → shows the new project).
- `/p/:id` project page, three plain sections:
  1. **Connection** — DSN input (password-style), save + test with the
     sanitized result states from 007, current host/db display.
  2. **Agent access** — mint token (shown once with copy + "you won't see
     this again"), token list, MCP setup snippet (copyable):
     `claude mcp add --transport http repanel <api-url>/mcp --header
     "Authorization: Bearer <token>"` plus a generic JSON config block for
     other clients, and the action-secret reveal (from 012) with one line
     on what it's for, linking docs/SIGNING.md.
  3. **Definition** — status card: none → "connect your agent and ask it to
     create your admin" (this is the empty state that sells the loop);
     invalid → error list rendered path/message/hint; valid → updated_at +
     prominent "Open admin" → `/a/:projectKey`.
- `use-projects.ts` hook per convention; status polled (10s) while on the
  page so the agent's submissions appear live.

## Out of scope (binding)
Workspaces/members, project rename/delete, token revocation UI, billing,
onboarding tours, publishing (drafts render directly in POC), any redesign
of runtime components.

## Acceptance
- [ ] Full manual loop documented with screenshots: create project → save +
      test connection → mint token → connect agent → watch status flip to
      valid → Open admin
- [ ] Specs: status card three states; token shown-once flow; create dialog
- [ ] Definition errors render hint text (the #008 payoff, visible to humans)

## Allowed dependencies
None new.
