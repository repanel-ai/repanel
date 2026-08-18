# Task 002 · API foundation

## Context

`apps/api` is the NestJS backend: control plane, MCP server, validation, and
data providers will all live here. This task builds only the foundation —
application skeleton, configuration, database wiring, and the error-handling
spine. No product features. Read CLAUDE.md ("Backend architecture",
"Anti-overengineering rules") first. Task 001 (`packages/contracts`) is
already merged; this task makes the API consume it, which requires giving
contracts a compiled output (revisiting task 001's verdict on src-pointing
exports).

## Scope

### 1. Amend `packages/contracts` (minimal)

- Add a `build` script: `tsc -p tsconfig.json` emitting `dist/`.
- Point `exports` / `main` / `types` at `dist/` instead of `src/`.
- Keep the `"./fixtures"` export path working (also via dist).
- No other changes to the package.

### 2. `apps/api` — NestJS application

Scaffold with the standard Nest CLI layout, then adjust:

```
apps/api/
  package.json            name: @repanel/api
  tsconfig.json           extends ../../tsconfig.base.json; may override
                          module/moduleResolution if Nest's compiler needs it
  nest-cli.json
  .env.example
  drizzle.config.ts
  src/
    main.ts               bootstrap; global zod validation pipe wiring comes
                          with the first DTO-carrying feature, not now
    app.module.ts
    config/               config.module.ts, config.service.ts, env.schema.ts
    db/                   db.module.ts, db.service.ts, schema/index.ts (empty for now)
    errors/               domain-error classes + one global exception filter
    health/               health.module.ts, health.controller.ts, health.service.ts (+ spec)
```

### 3. Configuration

- `env.schema.ts`: zod schema for the environment — `NODE_ENV`
  (development|test|production, default development), `PORT` (coerced number,
  default 3001), `DATABASE_URL` (required, url).
- Wire it through `@nestjs/config` with a `validate` function that parses via
  the zod schema and **throws with a readable message listing every invalid
  variable** (fail fast at boot).
- `config.service.ts`: a typed accessor over the validated env. Features
  inject this; `process.env` appears nowhere else in `src/`.

### 4. Database wiring (no tables yet)

- `db.module.ts` + `db.service.ts`: wraps Drizzle over `pg` Pool, connected
  from config. The service exposes the Drizzle instance and manages pool
  lifecycle (`onModuleDestroy`).
- `src/db/schema/index.ts` exists and is empty — tables arrive with the
  features that own them (auth in task 003).
- `drizzle.config.ts` set up for drizzle-kit migrations
  (out: `apps/api/drizzle/`), with `db:generate` and `db:migrate` scripts in
  the api package.json.
- Root `docker-compose.yml`: a single `postgres:17-alpine` service for local
  development, matching `.env.example`'s DATABASE_URL.

### 5. Errors spine

- `errors/domain-errors.ts`: base `DomainError` plus `NotFoundError`,
  `ForbiddenError`, `ConflictError`, `ValidationFailedError` (carries a
  details array compatible with the contracts `ValidationError` shape).
- One global exception filter mapping domain errors → HTTP status + safe JSON
  body `{ error: { code, message, details? } }`. Unknown errors → 500 with a
  generic message; full error logged server-side via Nest's `Logger`. No stack
  traces, ORM text, or internals in any response.

### 6. Health feature (proves the layering)

- `GET /health` → `{ status: "ok", db: "up" | "down" }`. The service pings the
  DB through `DbService` (`select 1`), tolerating failure (db: "down", still
  200 — this is a liveness signal, not an alarm system).
- Controller thin, logic in service, spec for the service covering both the
  up and the down path.

### 7. Verification

- `pnpm -r build`, `pnpm -r typecheck`, `pnpm -r test` pass from the root.
- With docker-compose up: `pnpm --filter @repanel/api dev` boots, `/health`
  returns db up; with the DB stopped, `/health` returns db down; with
  `DATABASE_URL` unset, boot fails fast with the zod message.

## Out of scope (binding)

- No auth, users, sessions, projects, workspaces (tasks 003/004).
- No MCP anything (task 005).
- No database tables or migrations content — infra only.
- No request DTOs, no global pipes beyond what §2 states, no CORS/helmet/rate
  limiting, no logging library, no interceptors.
- No CI, no Dockerfile for the api itself, no deployment config.
- No changes to `apps/web` (doesn't exist yet) or to docs.

## Acceptance

- [ ] All checks in §7 pass
- [ ] `process.env` referenced only inside the config module
- [ ] Health service spec asserts behavior for db-up and db-down (error path)
- [ ] Exception filter spec: a thrown `NotFoundError` maps to 404 with the safe
      body shape; an unknown `Error` maps to 500 with no message leakage
- [ ] `packages/contracts` builds to dist and `@repanel/api` imports a type
      from it successfully (e.g. the ValidationError type used in errors/)
- [ ] `.env.example` documents every variable in the env schema

## Allowed dependencies (apps/api unless noted)

Runtime: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`,
`@nestjs/config`, `reflect-metadata`, `rxjs`, `zod`, `drizzle-orm`, `pg`.
Dev: `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`, `drizzle-kit`,
`@types/pg`, `@types/express`, plus Nest's default Jest testing stack
(`jest`, `ts-jest`, `@types/jest`).
Nothing else. If Nest/ESM interop with the contracts package forces a
different arrangement than described, STOP and explain the options instead
of improvising.
