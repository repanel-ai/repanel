# Task 001b · Schema safety checks (amendment to 001)

## Context
Task 001's summary surfaced three cases where the schema permits what the
runtime must refuse. Per DECISIONS #008, contradictions die at validation
with a hint, not at runtime. This amendment adds three referential checks,
one workspace-hygiene change, and one docs heading. Nothing else.

## Scope
1. **Referential check — sensitive in URL templates:** an `httpCall` URL
   template placeholder referencing a `sensitive` field is an error. Hint
   must explain the leak (URLs reach logs and proxies) and suggest using a
   non-sensitive identifier (e.g. the primary key) instead.
2. **Referential check — hidden fields in views:** a `hidden` field
   referenced by table columns, search, filters, or defaultSort is an error
   (hidden fields are excluded from list payloads). Referencing a hidden
   field in DETAIL SECTIONS remains VALID — hidden means "detail-only",
   and the hint for the error cases should say exactly that.
3. **Referential check — dbUpdate target types:** `dbUpdate` may target
   only `enum` (value in values — existing check stands) or `boolean`
   (value must be the literal `true` or `false`; extend the action schema's
   value type accordingly). Targets of type json, relation, text, longText,
   number, date, dateTime, email, url, or any field flagged `sensitive`
   are errors. Hint for rejected targets: rule-bearing updates belong in a
   customer endpoint via an `httpCall` action (DECISIONS #010).
4. **TypeScript hoisting:** exactly one `typescript` version for the whole
   workspace — keep the currently-working major in the ROOT devDependencies,
   remove `typescript` from packages/contracts devDependencies. `pnpm -r
   typecheck` must still pass.
5. **SCHEMA.md:** add a "Known limitations (v0)" section documenting the
   identifier rule (`[A-Za-z_][A-Za-z0-9_]*`; quoted/exotic Postgres
   identifiers unsupported) and the dbUpdate target restriction.

## Out of scope (binding)
Any other schema change, any new field types or flags, fixture redesign
(extend it only as needed to exercise the new checks), any code outside
packages/contracts and the root package.json.

## Acceptance
- [ ] Each new check has failing-case tests asserting exact `path` and `hint`
- [ ] Hidden-in-detail-section explicitly covered by a PASSING test
- [ ] dbUpdate-on-boolean covered by a passing test; each rejected target
      type by a failing test
- [ ] Fixture still validates with zero errors
- [ ] One `typescript` entry in the workspace (root); `pnpm -r typecheck`
      and `pnpm -r test` pass

## Allowed dependencies
None new.
