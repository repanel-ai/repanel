# Current Scope — POC

One question: **can a coding agent inspect an app, submit a definition through
MCP, and produce a usable, polished admin without the developer building it?**

## In scope (POC)

- Project creation, agent auth, MCP server: read project, submit/validate
  definition, read precise errors, preview draft
- PostgreSQL provider (read paths: list, detail, search, filter, sort, paginate)
- Definition: resources, fields, relationships, table views, detail views
- One DB-mutation action type AND one customer-HTTP-endpoint action
  (the HTTP action proves "the app owns business logic" mechanically)
- RePanel user auth (sessions), draft rendering with the real runtime
- Visual quality is IN scope: the rendered admin must look deliberate, not
  like a generated database browser. Quality is the wedge, not polish.

## Deliberately out (POC — do not build)

- MySQL or any second database
- Create/edit forms (read + actions only; forms are a later, opt-in layer)
- Versioning/rollback, environments, audit, roles beyond "member"
- Bulk actions, multi-step actions, retries, background job tracking
- Custom SQL, aggregates, calculated columns
- Any visual builder surface

## Acceptance

Reference app (SkyScout-like SaaS: users, airlines, candidates, job openings,
applications) generates through MCP: tables with search/filter/sort/pagination,
detail pages with relationships, an approve action (HTTP) and a status action (DB).

At least ONE resource must be "hostile": a JSONB column, a soft-delete flag, and
a status field the agent must mark read-only-with-action rather than editable.
If the loop handles that resource, the thesis is proven.

## Delivery order

1. Definition schema + validator (contracts) — everything hangs off this
2. API foundation: config, db, auth, projects
3. MCP server (submit / validate / read errors)
4. Postgres provider + query engine (read paths)
5. Runtime renderer (tables, detail, navigation) — before any control-plane polish
6. Actions (DB + HTTP)
7. Control plane UI (project creation, MCP setup, preview shell)
