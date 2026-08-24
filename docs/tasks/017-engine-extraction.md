# Task 017 · packages/engine — PLAN GATE

## Context
`repanel dev` (019) and the connector (031) both need the query engine
outside apps/api. Per the roadmap decision, the safety core is extracted
once into a third shared package. This is a RELOCATION of proven code,
not a rewrite — #024's builder is pure and #014's rules move with it.

PLAN GATE: post (1) the exact module list moving (query builder, pool
manager/customer pool, value mapping, runtime read/action execution
logic, and what stays behind as thin Nest adapters), (2) the package's
public API surface, (3) how apps/api consumes it afterwards with zero
behavior change. Wait for approval.

## Scope
- `packages/engine` (`@repanel/engine`): ESM, Node-only, depends on
  `@repanel/contracts` + `pg` and nothing else. No Nest, no HTTP, no env
  reads — configuration is passed in.
- Move the pure logic; apps/api keeps thin injectable adapters that
  delegate (config, DI, HTTP stay in the app). Every existing api test
  keeps passing; engine gains its own test setup with the moved unit
  tests (integration suites stay in api where the gated DB lives).
- Build/typecheck wiring per the contracts precedent (dist exports,
  tsconfig.build).

## Out of scope (binding)
Any behavior change, any new capability, the CLI, the connector, HTTP
transports, publishing. If a seam requires changing behavior to cut,
STOP and present it.

## Acceptance
- [ ] apps/api's runtime/action endpoints behave identically (full suite
      green, counts stated before/after)
- [ ] engine imports cleanly standalone; no Nest/env/HTTP references
      (grep gate in summary)
- [ ] #014's safety tests live with the code they test

## Allowed dependencies
None new.
