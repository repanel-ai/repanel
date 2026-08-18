# Decision Log

Append-only. Format: number, date, decision, why. Reversing a decision is a new
entry, never an edit.

001 · 2026-08 · pnpm monorepo: apps/api (NestJS), apps/web (React+Vite),
packages/contracts. Contracts is the only shared package; DB schemas stay in
the API. Why: one source of truth for the wire contract; no package sprawl.

002 · 2026-08 · zod everywhere (env, request DTOs, definition schema). No
decorator-based validation. Why: the definition schema must be validatable
outside RePanel (public contract, browser-safe, standalone validator later);
one validation idiom across the codebase.

003 · 2026-08 · Definition schema is milestone zero, designed before the MCP
server or renderer. Why: it is the public product contract; everything else
consumes it.

004 · 2026-08 · Postgres only through POC and MVP. No MySQL. Why: make one
ecosystem exceptional; a second DB is pure scope cost before first customers.

005 · 2026-08 · Renderer quality before control-plane polish. Why: the demo
that sells the product is the generated admin, not the dashboard.

006 · 2026-08 · One HTTP action in the POC (not deferred to MVP). Why:
"the application owns business logic" must be proven mechanically, early.

007 · 2026-08 · Create/edit forms deferred; POC/early MVP is world-class
read + actions, forms later behind per-resource opt-in. Why: safety risk and
complexity concentrate in writes; read-only-by-default buys trust.

008 · 2026-08 · MCP validation errors must carry: exact location, expectation,
suggested fix. Why: error quality determines agent success rate; it is the
cheapest highest-leverage feature in the loop.

009 · 2026-08 · Work is executed as bounded task files (docs/tasks/) run by a
coding agent; CLAUDE.md is the standing rulebook. Out-of-scope lists are binding.
