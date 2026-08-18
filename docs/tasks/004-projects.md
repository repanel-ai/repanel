# Task 004 · Projects

## Context
A project is the unit everything hangs off: connection, definition, agent
tokens, hosted admin. POC ownership model is deliberately flat: a project
belongs to one user. Workspaces come post-POC.

## Scope
- Table: `projects` (id uuid pk, user_id fk, name, key unique, created_at).
  Migration included.
- Project key: slugified name + `-` + 6 lowercase alphanumeric chars
  (e.g. `skyscout-a3k9x2`), generated at creation, immutable, retried on the
  (unlikely) unique collision. This key is the stable routing identity.
- `projects/` feature module: `POST /projects` (name), `GET /projects`
  (own only), `GET /projects/:id` (own only; others' → NotFoundError, not
  Forbidden — don't leak existence).
- Ownership check lives in the service (`requireOwned`), reused by later
  features via the exported service.
- DTOs in contracts under `src/projects/`.

## Out of scope (binding)
Rename/delete project, key regeneration, workspaces/members, transfer,
pagination of the list, connections, definitions, agent tokens.

## Acceptance
- [ ] Service specs: create (key format asserted by regex), list scoped to
      owner, get of another user's project → NotFoundError
- [ ] Key collision path covered (mock the collision, assert retry)

## Allowed dependencies
None new.
