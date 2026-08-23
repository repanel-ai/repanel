# Task 013 · Crewbase reference app + authoring guide

## Context
Crewbase is the acceptance vehicle (SCOPE.md): a realistic customer app a
fresh coding agent must turn into an admin through MCP, including the
hostile resource. It also anchors docs/AUTHORING.md — the guide any
customer's agent reads. This task builds the app and the guide; the
acceptance RUN is checkpoint D, performed manually.

## Scope
### examples/crewbase (added to the pnpm workspace via examples/*)
- Minimal NestJS app + drizzle, its own docker-compose service (port
  differs from RePanel's db) and seed script (`pnpm --filter crewbase seed`)
  generating ~200 realistic rows across tables. No UI.
- Tables: `users` (name, email, status enum, password_hash — the sensitive
  trap, created_at), `airlines` (name, country, approval_status enum,
  verification jsonb), `candidates` — THE HOSTILE RESOURCE: (type enum,
  status enum meant to be read-only-with-action, profile jsonb, deleted_at
  soft delete, airline_id fk), `job_openings` (airline_id fk, title,
  status), `applications` (candidate_id fk, opening_id fk, status enum,
  created_at).
- One business endpoint proving decision 013:
  `POST /repanel/airlines/:id/approve` — mounted admin-API module with the
  HMAC verification middleware implemented per docs/SIGNING.md, flipping
  approval_status with a business rule (only from `pending`; else 409).
- README: how to run + seed, and what the hostile traps are (for humans).

### docs/AUTHORING.md (the customer-agent guide — written FOR an agent)
- The workflow: inspect the repo (schema, enums, relations, sensitive
  columns, existing admin-API endpoints) → connect MCP → call
  get_schema_documentation → author → submit → repair from errors → done.
- The safety rules an authoring agent must follow: password/token/secret
  columns are `sensitive`; internal jsonb is `hidden` or a detail-only
  field; a status with business rules becomes read-only + an action (httpCall
  if an endpoint exists, dbUpdate only for rule-free flips); soft-delete
  columns are `hidden` (and a note that default-filtering is a known v0
  gap); prefer existing /repanel/* endpoints over dbUpdate.
- Kept stack-neutral except one short NestJS-specific "where to look"
  section (per decision 011 this is the first per-stack guide's seed).

## Out of scope (binding)
Running the acceptance itself (checkpoint D), auth on Crewbase beyond the
HMAC middleware, Crewbase tests beyond the approve endpoint's rule, any
RePanel core changes (if a gap is found, STOP and report it — that is the
point of the exercise).

## Acceptance
- [ ] Fresh clone: docker up + seed + run works from the README
- [ ] Approve endpoint spec: valid signature + pending → approved; invalid
      signature → 401; non-pending → 409
- [ ] AUTHORING.md dry-read: an agent following it would classify
      password_hash, candidates.status, and deleted_at correctly (walk
      through this reasoning in the summary)

## Allowed dependencies
Within examples/crewbase only: the same Nest/drizzle/pg set as apps/api.
