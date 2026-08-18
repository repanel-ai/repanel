# Task 001 · Definition schema v0 + validator

## Context

The RePanel definition is the public product contract: a coding agent generates
it, RePanel validates and renders it. Everything else in the product consumes
this schema, so it is built first. Read `docs/VISION.md` (sections "The loop",
"Principles") and `docs/SCOPE.md` before starting. It lives in
`packages/contracts` and must be importable in both Node and the browser.

## Scope

Create `packages/contracts` with this structure:

```
packages/contracts/
  package.json          name: @repanel/contracts, type: module, ESM only
  tsconfig.json         extends ../../tsconfig.base.json
  src/
    index.ts            barrel export
    definition/
      schema.ts         zod schemas + inferred types (split into more files if large)
      validate.ts       validateDefinition()
      *.test.ts         co-located tests
      fixtures/         one valid reference definition used by tests
  SCHEMA.md             human-readable documentation of the format
```

### The schema (v0, `schemaVersion: "0.1"`)

Design zod schemas expressing these concepts. You decide the exact shape —
keep it flat, readable, and obvious to a human scanning a committed definition
file. Where you make a non-trivial shape decision, note it in your summary.

- **Definition root**: `schemaVersion`, app metadata (name), navigation
  (ordered groups of resource references), resources.
- **Resource**: stable `key`, display names (singular/plural), source binding
  (v0: a postgres table name), primary key field, fields, relationships,
  a table view, a detail view, actions. A resource can be marked fully
  `readOnly` (v0 default and only mode — see out of scope).
- **Field**: `key` (column name), label, type — one of: `text`, `longText`,
  `number`, `boolean`, `date`, `dateTime`, `email`, `url`, `enum` (with
  values), `json`, `relation` (with target resource key). Flags: `sensitive`
  (never leaves the API unmasked), `hidden` (exists but not displayed).
- **Relationship**: `belongsTo` / `hasMany`, target resource key, foreign key
  field. (many-to-many is out of scope for v0.)
- **Table view**: ordered columns (field refs), default sort (field + direction),
  searchable fields (text-type only), filters — each filter binds to a field and
  is one of: `enum`, `boolean`, `dateRange`, `relation`, plus free-text search.
- **Detail view**: ordered sections, each with a title and field refs; related
  lists (relationship refs).
- **Action**: `key`, label, confirmation message (required), and exactly one of:
  - `dbUpdate`: set one field to one literal value (e.g. status → "approved")
  - `httpCall`: method, URL template (may reference record fields as
    `{field}`), no request body in v0.

### The validator

`validateDefinition(input: unknown): ValidationResult` where a failure returns
a list of errors, each with:

- `path` — exact JSON path to the problem (e.g. `resources[2].views.table.columns[0]`)
- `message` — what is wrong
- `expected` — what would be valid
- `hint` — a concrete suggested fix, written so a coding agent can act on it

Two validation passes:

1. **Structural** — the zod parse, with zod issues translated into the error
   shape above (do not return raw zod issues).
2. **Referential** — checks zod cannot express: every navigation entry, column,
   filter, section field, sort field, search field, relationship target, and
   relation field target references a key that exists; searchable fields are
   text-typed; filter kinds match field types; `sensitive` fields do not appear
   in table columns; action `httpCall` URL templates only reference existing
   field keys; resource keys and field keys are unique.

Error quality is the point of this task (see `docs/DECISIONS.md` #008). Every
referential check needs a test asserting the exact `path` and a useful `hint`.

### Fixture

One valid reference definition modeling a small SaaS (users, organizations,
orders is enough) including: an enum field, a relation, a sensitive field, a
json field, both action kinds, and navigation groups. Tests import it; later
tasks will reuse it.

## Resolved decisions (from the approved plan review — implement as stated)

The plan gate for this task already ran. These rulings are final; do not
re-plan, implement directly:

1. **Strict objects everywhere.** Unknown keys are a validation error.
2. **Extra uniqueness checks:** relationship keys and action keys must be
   unique per resource, in addition to resource keys and field keys.
3. **Relationship foreignKey existence:** `belongsTo` → the FK must exist in
   this resource's fields; `hasMany` → in the target resource's fields.
4. **`dbUpdate` value vs enum:** if the target field is an enum, the literal
   value must be one of its values (referential check + test).
5. **Searchable "text-type"** means: `text`, `longText`, `email`, `url`.
6. **No build step in this task.** `exports` may point at `./src/index.ts`;
   no `dist`. (Task 002 revisits this when NestJS consumes the package —
   note that in your summary.)
7. **Fixture is NOT exported from the main barrel.** Add a separate
   package.json export path `"./fixtures"` pointing at the fixtures module;
   later tasks import `@repanel/contracts/fixtures`.

Shape rulings from the approved plan (follow them): resources as an array
of objects with `key` (not a keyed record); views under a `views` object
(`views.table`, `views.detail`); refs as bare strings (columns, search,
section fields, relatedLists, navigation resources); actions as a flat
discriminated union on `kind`; field types as a discriminated union on
`type`; validator returns `{ valid: true, definition } | { valid: false,
errors }`; structural failure skips the referential pass; root-level error
paths render as `(root)`.

Housekeeping: if the repo root is missing `.gitignore` (dotfiles sometimes
get lost when copying the bootstrap), recreate it with: `node_modules/`,
`dist/`, `.env`, `.env.*`, `!.env.example`, `*.log`, `coverage/`,
`.repanel/`. Commit `pnpm-lock.yaml`; ignore only `node_modules/`.

## Out of scope (binding)

- Create/edit forms, editable fields, or any write configuration beyond the two
  action kinds. v0 resources are read-only + actions by design.
- Many-to-many relationships, bulk actions, action inputs/bodies, roles or
  permissions, MySQL or HTTP data sources, computed/aggregate columns.
- YAML/file serialization, schema migration tooling, JSON-schema export.
- Any code outside `packages/contracts`. No API, no MCP, no UI.
- No workspace-root changes except adding the package to the pnpm workspace
  (already covered by the `packages/*` glob) and the `.gitignore`
  housekeeping above if needed.

## Acceptance

- [ ] `pnpm -r typecheck` and `pnpm -r test` pass from the repo root
- [ ] The fixture validates with zero errors
- [ ] Every referential rule above (including resolved decisions 2–4) has at
      least one failing-case test asserting `path` and `hint`
- [ ] A structurally broken input (wrong type, missing required key) produces
      the translated error shape, not raw zod output
- [ ] An unknown key anywhere produces a precise "unrecognized key" error
- [ ] `SCHEMA.md` documents every concept with a short example each
- [ ] Package imports cleanly with no server-only or browser-only dependencies

## Allowed dependencies

`zod` (runtime), `typescript`, `tsx` (dev, test runner via `node --test`).
Nothing else.
