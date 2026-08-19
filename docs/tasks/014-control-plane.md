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

### Console (apps/web)
Placement (DECISIONS #025): the control plane is the console's, so every screen
below lives in **apps/web**, built from the same **packages/ui** components the
runtime uses — reused at lower density, with no design language of its own.

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
     prominent "Open admin" → `/a/:projectKey` on the runtime app. That is a
     different origin in dev (#025), so the link is absolute and built from
     configuration, not a router navigation.
- `use-projects.ts` hook per convention; status polled (10s) while on the
  page so the agent's submissions appear live.

## Out of scope (binding)
Workspaces/members, project rename/delete, token revocation UI, billing,
onboarding tours, publishing (drafts render directly in POC), any redesign
of runtime components, any new component in packages/ui that only the console
would use.

## Acceptance
- [ ] Full manual loop documented with screenshots: create project → save +
      test connection → mint token → connect agent → watch status flip to
      valid → Open admin
- [ ] Specs: status card three states; token shown-once flow; create dialog
- [ ] Definition errors render hint text (the #008 payoff, visible to humans)

## Allowed dependencies
None new.
