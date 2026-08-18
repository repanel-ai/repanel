# Task 008 · Query engine + runtime data API — PLAN GATE

## Context
The most safety-critical code in the product: it executes reads against the
CUSTOMER's database, driven entirely by the validated definition. Append
decision 014 to docs/DECISIONS.md first (text in ROADMAP.md) — it is the law
of this module: identifiers only from the definition, values only as bound
parameters, sensitive fields never selected, limits and timeouts always.

PLAN GATE: before code, post (1) the SQL-building approach and how identifier
safety is guaranteed, (2) the runtime API routes + query-param format,
(3) the additive contracts change below. Wait for approval.

## Scope
- Additive contracts amendment: `resource.labelField` (optional field key;
  defaults to primaryKey) — the field used to display a record and to label
  relations. Referential check: must reference an existing field. Update
  SCHEMA.md + fixture.
- `runtime/` feature module (session auth; POC authorization = project owner):
  - `GET /runtime/:projectKey/definition` — the valid draft for the renderer
    (404 with clear message if none/invalid).
  - `GET /runtime/:projectKey/resources/:key/records` — query params: `page`
    (default 1), `pageSize` (default 25, max 100), `search`, `sort` +
    `direction` (allowlisted to definition fields), `filter[<field>]=<value>`
    (+ `filter[<field>][from|to]` for dateRange). Returns rows + total count
    + page info.
  - `GET /runtime/:projectKey/resources/:key/records/:id`
  - `GET /runtime/:projectKey/resources/:key/records/:id/related/:relationshipKey`
    (paginated like the list).
- `QueryBuilderService` (pure, thoroughly unit-tested): definition + request
  → `{ text, values }` parameterized SQL. Rules (decision 014):
  - SELECT lists explicit columns; `sensitive` fields are never in any
    SELECT. `hidden` fields excluded from list payloads, included in detail.
  - All identifiers double-quoted and sourced only from the definition.
  - Search: ILIKE across the view's search fields, single parameter.
  - Filters validated against the definition (unknown field/kind → 400
    domain error, not silently ignored).
  - belongsTo relation columns in tables resolve a label via LEFT JOIN on
    the target's labelField (only for relations present as columns).
  - Every query: LIMIT/OFFSET pagination, separate COUNT query, and
    per-query `statement_timeout` 5000ms via the customer pool.
- Values are returned JSON-safe (dates ISO, numerics as numbers where safe,
  json fields passed through).

## Out of scope (binding)
Writes of any kind, aggregates, computed columns, cursor pagination, caching,
many-to-many traversal, cross-resource search, query logging/analytics,
customer HTTP data provider.

## Acceptance
- [ ] QueryBuilder unit tests: identifier quoting, a hostile field key can
      never reach SQL unquoted (constructed attempt fails validation),
      sensitive exclusion, hidden list/detail difference, each filter kind,
      search, sort allowlisting, relation label join, pagination math
- [ ] Integration spec (runs when TEST_CUSTOMER_DATABASE_URL is set, skipped
      otherwise): seeds a table, exercises list/detail/related end to end
- [ ] Unknown filter/sort field → 400 with helpful message
- [ ] Timeout verified: a pg_sleep(10) query fails cleanly as a timeout error

## Allowed dependencies
None new.
