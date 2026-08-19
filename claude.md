# RePanel — Agent Guide

RePanel is an open-source **admin runtime**: a coding agent inspects a customer's
application, submits a structured *definition* through MCP, and RePanel renders it
as a hosted, polished admin interface. The customer owns the definition; RePanel
owns the runtime. Full context: `docs/VISION.md`, `docs/SCOPE.md`.

This file is the standing rulebook. Task files in `docs/tasks/` define **what** to
build; this file defines **how**.

## Monorepo

- `apps/api` — NestJS backend: control plane, MCP server, validation, data providers
- `apps/web` — the console: RePanel's own control-plane UI (login, projects, setup)
- `apps/runtime` — the generated admin renderer: the product's face; imports only
  `@repanel/ui` and `@repanel/contracts`
- `packages/contracts` — shared wire contract: DTOs, shared enums/unions, zod
  schemas, the public definition schema. Drizzle schemas and all persistence
  live in `apps/api`.
- `packages/ui` — shared owned component system + design tokens (strictly
  presentational; no data logic, no API clients)

## Stack (decided — do not substitute)

NestJS · Drizzle ORM · PostgreSQL · zod (all validation: env, DTOs, definition
schema) · React + Vite · TanStack Query · shadcn-style owned components over
Radix primitives + Tailwind (`packages/ui`); TanStack Table for data grids ·
pnpm workspaces.

## Backend architecture

Organize by **feature module**, not by technical layer. Each feature:

```
<feature>/
  <feature>.module.ts       imports / providers / exports
  <feature>.controller.ts   transport only: parse request, call ONE service method, return
  <feature>.service.ts      business logic, authorization, orchestration
  <feature>.repository.ts   all Drizzle access for the feature's own tables
  <feature>.mapper.ts       entity → DTO; persistence types NEVER leave the process
  <feature>.spec.ts         co-located tests
```

- Controllers contain zero logic. If a controller method exceeds a few lines,
  logic has leaked.
- Services may query Drizzle directly ONLY for incidental cross-entity reads
  (e.g. fetching a parent record for an authorization check). Own-table access
  always goes through the repository.
- Features depend on other features via their exported service, never internals.
- Cross-cutting infra (db client, crypto/secrets, MCP transport, queue) is its
  own injectable module. Every third-party SDK is wrapped in our own service.
- Request validation is declarative at the transport boundary (zod pipe).
  Services trust their inputs.
- Errors: services throw domain errors; one exception filter maps them to HTTP.
  Never leak stack traces, ORM messages, or internal IDs to clients.
- Env is validated with zod at boot (fail fast); read through one typed config
  service, never `process.env` in features.

## Frontend architecture

- `src/features/<feature>/` — components + `use-<feature>.ts` data hook
- Server state lives in TanStack Query, accessed only through the feature hook.
  Never fetch-in-useEffect. Cache keys come from a single factory per feature.
- Components take data via props, report events via callbacks. Containers wire
  hooks to components.
- One shared HTTP client in `src/lib/`; raw fetch only for named exceptions
  (streaming, multipart).

## Contracts package

- Request DTOs = zod schema + inferred type, co-located. Response DTOs = plain types.
- Must import cleanly into both Node and browser. No framework classes, no
  server-only or browser-only code, ever.
- The definition schema (`src/definition/`) is a **public product contract**.
  Changes to it are breaking changes for customers: additive only, versioned,
  never casual.

## Anti-overengineering rules (hard requirements)

This project must remain maintainable by a human and readable as exemplary
open-source code. Therefore:

1. **Use the framework.** NestJS DI, pipes, guards, exception filters, config
   module — never hand-roll what NestJS provides. Same for Drizzle, TanStack
   Query, zod. Hand-rolled infra where a framework idiom exists is a defect.
2. **Build only what the task file asks.** No speculative parameters, no
   "might need later" abstractions, no extra endpoints, no config for
   hypothetical futures. YAGNI is policy, not preference.
3. **The out-of-scope list in a task is binding.** If something seems missing,
   STOP and ask — do not invent it.
4. **No dumping grounds.** No `utils/`, `helpers/`, `common/` folders. A helper
   belongs to the feature that uses it; if two features need it, that's a
   deliberate decision to raise in the task summary.
5. **Small files, one responsibility.** A file you can't summarize in one
   sentence gets split.
6. **No new dependencies without approval.** Each task lists the packages it may
   add. Anything beyond that list: propose it in the summary, don't install it.
7. **Names say what, not how.** `requireOwned`, not `checkUserIdMatchesRow`.

## Testing

- Test behavior, not mocks: assert returned values, persisted state, thrown
  domain errors. Services, mappers, and the definition validator get thorough
  tests including error paths. Controllers and presentational components get
  light coverage.
- Tests are co-located. Test output must be clean — no stray console noise.

## Definition of done (every task)

- [ ] Scope of the task file implemented; nothing beyond it
- [ ] `pnpm typecheck` and `pnpm test` pass from the repo root
- [ ] New logic has tests, including at least one error path
- [ ] No new dependencies beyond those the task names
- [ ] Files follow the layering above; no persistence types in DTOs
- [ ] Short summary of what changed and any open questions, then stop
