# RePanel definition schema — v0 (`schemaVersion: "0.1"`)

A **definition** describes an admin interface: which resources exist, what their
fields mean, how they relate, how they are listed and shown, and which actions
an operator may run. A coding agent writes it, RePanel validates and renders it.

It expresses *intent*, never layout. There is no component tree, no styling, no
branching — the runtime owns presentation. v0 resources are **read-only**: the
only writes are the two action kinds at the end of this document.

Validate a definition with `validateDefinition(input)` from
`@repanel/contracts`. A complete, valid example lives in
`@repanel/contracts/fixtures`.

---

## The root

```json
{
  "schemaVersion": "0.1",
  "app": { "name": "Acme Admin" },
  "navigation": [{ "label": "Customers", "resources": ["organizations", "users"] }],
  "resources": []
}
```

| Key | Required | Meaning |
|---|---|---|
| `schemaVersion` | yes | Always `"0.1"` in v0. |
| `app.name` | yes | Product name shown in the admin shell. |
| `navigation` | yes, ≥1 | Ordered sidebar groups. |
| `resources` | yes, ≥1 | Every resource the admin exposes. |

Unknown keys are rejected everywhere — a typo is an error, never a silently
ignored setting.

## Navigation

An ordered list of groups; each group lists resource keys in display order.

```json
{ "label": "Commerce", "resources": ["orders"] }
```

A resource does not have to appear in navigation, and the group label is free
text.

## Resource

A resource binds one postgres table to one admin section.

```json
{
  "key": "users",
  "label": { "singular": "User", "plural": "Users" },
  "source": { "table": "users" },
  "primaryKey": "id",
  "labelField": "email",
  "readOnly": true,
  "fields": [],
  "relationships": [],
  "views": { "table": {}, "detail": {} },
  "actions": []
}
```

| Key | Required | Meaning |
|---|---|---|
| `key` | yes | Stable identifier, unique in the definition. Used in URLs and every reference. |
| `label` | yes | Display names; the runtime picks singular or plural per context. |
| `source.table` | yes | Postgres table name. |
| `primaryKey` | yes | Field key used to address one record. Must not be `sensitive`. |
| `labelField` | no (default `primaryKey`) | Field key a record is displayed by. Must not be `sensitive`, `hidden`, `json` or `relation`. |
| `readOnly` | no (default `true`) | v0 accepts only `true`. |
| `fields` | yes, ≥1 | Columns the admin knows about. |
| `relationships` | no (default `[]`) | Links to other resources. |
| `views` | yes | The table view and the detail view. |
| `actions` | no (default `[]`) | Operator-triggered writes. |

`labelField` is what a human reads instead of a record. A table showing a
relation column renders the target's label rather than its raw foreign key, and
every link to a record is titled with it. Left out, it falls back to
`primaryKey` — always present, and almost never what anyone recognizes a record
by, so setting it is worth the one line.

Keys — resource, field, relationship, action keys and the table name — are
letters, digits and underscores, never starting with a digit. The runtime
always double-quotes them in SQL, so they reach Postgres exactly as written:
`avatarUrl` stays `avatarUrl` and is never folded to `avatarurl`.

## Field

```json
{ "key": "status", "label": "Status", "type": "enum", "values": ["invited", "active"] }
```

| Type | Notes |
|---|---|
| `text` | Single-line string. |
| `longText` | Multi-line string. |
| `number` | Numeric. |
| `boolean` | True/false. |
| `date` | Calendar date. |
| `dateTime` | Timestamp. |
| `email` | String rendered as a mail link. |
| `url` | String rendered as a link. |
| `enum` | Requires `values` (≥1 strings). May carry `tones`. |
| `json` | Structured blob, rendered as inspectable JSON. |
| `relation` | Requires `target`: the key of the resource it points at. |

An `enum` may say how grave each of its values is:

```json
{
  "key": "status",
  "label": "Status",
  "type": "enum",
  "values": ["invited", "active", "suspended"],
  "tones": { "active": "positive", "suspended": "critical" }
}
```

| Key | Required | Meaning |
|---|---|---|
| `tones` | no (default `{}`) | Value → `positive` \| `neutral` \| `attention` \| `critical`. Every key must be one of the field's own `values`. |

Severity is stated here or not at all: the runtime has never seen the
customer's vocabulary, and it never reads a value's spelling for meaning —
`suspended` is routine in one product and an alarm in the next. A value the map
leaves out renders quiet, which is also what every value gets while the map is
absent.

Two flags, both defaulting to `false`:

```json
{ "key": "password_hash", "label": "Password hash", "type": "text", "sensitive": true }
{ "key": "settings", "label": "Settings", "type": "json", "hidden": true }
```

- `sensitive` — never leaves the API unmasked, and never probeable: it may not
  appear in table columns, search, filters, the table's `defaultSort`, or an
  `httpCall` URL template, it may not be the target of a `dbUpdate` action, and
  it can be neither the resource's `primaryKey`, its `labelField`, nor a
  relationship's `foreignKey`. Ordering and joining are probes as much as
  filtering is: a sort exposes the order it puts the rows in, and a foreign key
  is a column the runtime reads and matches on.
- `hidden` — **detail-only**. Hidden fields are excluded from list payloads, so
  a hidden field cannot be a table column, a search field, a filter, the
  default sort, or the `labelField`. It may still appear in a detail section.

## Relationship

```json
{ "key": "orders", "kind": "hasMany", "target": "users", "foreignKey": "user_id" }
```

| Key | Meaning |
|---|---|
| `key` | Stable identifier, unique within the resource; detail views reference it. |
| `kind` | `belongsTo` or `hasMany`. Many-to-many is out of scope in v0. |
| `target` | Key of the resource on the other end. |
| `foreignKey` | For `belongsTo`, a field on **this** resource; for `hasMany`, a field on the **target**. Must not be `sensitive`. |

The runtime derives the label from the target's `label`, so a relationship
carries no display configuration.

## Table view

```json
{
  "columns": ["email", "name", "status"],
  "defaultSort": { "field": "created_at", "direction": "desc" },
  "search": ["email", "name"],
  "filters": [{ "field": "status", "kind": "enum" }]
}
```

| Key | Required | Meaning |
|---|---|---|
| `columns` | yes, ≥1 | Ordered field keys. Sensitive and hidden fields are rejected. |
| `defaultSort` | yes | `field` plus `direction` (`asc` \| `desc`). Required so pagination is deterministic; the field must be neither hidden nor `sensitive`. |
| `search` | no (default `[]`) | Field keys the free-text box queries — only `text`, `longText`, `email` and `url` fields, none of them hidden or sensitive. |
| `filters` | no (default `[]`) | Faceted filters, each bound to one field that is neither hidden nor sensitive. |

A filter's `kind` must match the type of the field it binds to:

| `kind` | Valid field types |
|---|---|
| `enum` | `enum` |
| `boolean` | `boolean` |
| `dateRange` | `date`, `dateTime` |
| `relation` | `relation` |

Fields of any other type cannot be filtered in v0.

## Detail view

```json
{
  "sections": [{ "title": "Account", "fields": ["email", "name", "status"] }],
  "relatedLists": ["orders"]
}
```

| Key | Required | Meaning |
|---|---|---|
| `sections` | yes, ≥1 | Ordered groups, each with a `title` and ≥1 field keys. |
| `relatedLists` | no (default `[]`) | Relationship keys rendered as embedded lists. |

A related list may name either kind of relationship. The runtime renders it as
the target resource's table view — the target's columns, search, filters and
sort — so a `hasMany` list is a page of records and a `belongsTo` list shows at
most one.

## Action

Every action states what it does and asks before doing it: `confirm` is
required, because every action is a write against a read-only resource.

```json
{
  "key": "suspend",
  "label": "Suspend",
  "confirm": "Suspend this user? They lose access immediately.",
  "kind": "dbUpdate",
  "field": "status",
  "value": "suspended"
}
```

```json
{
  "key": "resend_invite",
  "label": "Resend invite",
  "confirm": "Send the invitation email again?",
  "kind": "httpCall",
  "method": "POST",
  "url": "https://api.acme.test/repanel/users/{id}/resend-invite"
}
```

| Kind | Keys | Meaning |
|---|---|---|
| `dbUpdate` | `field`, `value` | Sets one field to one literal. The target must be an `enum` field (the literal is one of its `values`) or a `boolean` field (the literal is `true` or `false`), and never a `sensitive` field. |
| `httpCall` | `method`, `url` | Calls the customer's application. `{field_key}` placeholders are filled from the record; every placeholder must name a field of the resource, and never a `sensitive` one. No request body in v0. |

Business logic belongs in the customer's application: anything conditional or
multi-step is an endpoint invoked by `httpCall`, not configuration here.

## Validation

`validateDefinition(input: unknown)` returns either

```ts
{ valid: true, definition }              // defaults applied, ready for the runtime
{ valid: false, errors: ValidationError[] }
```

Each error is written for a coding agent to act on:

```json
{
  "path": "resources[1].views.table.columns[5]",
  "message": "Sensitive field `password_hash` cannot be a table column.",
  "expected": "a field that is not marked `sensitive`",
  "hint": "Remove `password_hash` from `resources[1].views.table.columns` and show a non-sensitive field instead; a sensitive value never leaves the API unmasked."
}
```

A hint suggests only safe fixes. Where the problem is containment — a
`sensitive` field somewhere it may not be — the hint never offers relaxing the
flag as the way out, because the shortest path an error describes is the path an
authoring agent takes. A `hidden` field is a display choice, so unsetting it is
a real remedy and its hints say so.

Validation runs in two passes. The **structural** pass is the schema parse:
types, required keys, allowed values, unknown keys. The **referential** pass
then checks what a schema cannot express:

- every navigation entry, column, sort field, search field, filter field,
  section field, related list, relationship target, relation-field target,
  primary key, label field, `dbUpdate` field and `httpCall` URL placeholder
  names something that exists;
- resource, field, relationship and action keys are unique;
- a `belongsTo` foreign key exists on the declaring resource, a `hasMany`
  foreign key on the target;
- searchable fields are text-typed and filter kinds match field types;
- sensitive fields never appear as table columns, search fields, filters or
  the default sort, never inside an `httpCall` URL template, and are never a
  resource's primary key, its label field, or a relationship's foreign key;
- hidden fields never appear as table columns, search fields, filters, the
  default sort or the label field — detail sections may still use them;
- a label field reads as a name: never a `json` or `relation` field;
- a `dbUpdate` targets only a non-sensitive `enum` or `boolean` field, and
  writes one of the enum's values or a boolean literal;
- every key of an enum's `tones` map is one of that enum's declared `values`.

A structural failure skips the referential pass: those checks need a
well-typed definition to walk, and errors invented from a half-parsed tree
would point at the wrong place. Fix the structure, validate again.

## Known limitations (v0)

**Identifiers.** Resource, field, relationship and action keys — and the source
table name — must match `[A-Za-z_][A-Za-z0-9_]*`. Case is not a limitation:
every identifier is double-quoted on its way into SQL, so a Prisma-style
schema — table `User`, column `avatarUrl` — is fully supported and reaches
Postgres unfolded. What v0 cannot express is a name outside that pattern: a
space (`First Name`), a leading digit, a non-ASCII letter, or an embedded
quote. A table using one cannot expose that column until the schema grows a
way to write it down.

**`dbUpdate` targets.** A `dbUpdate` action may set only an `enum` or `boolean`
field, and never a `sensitive` one. Text, numbers, dates, JSON and relations are
excluded on purpose: setting them almost always carries rules — validation, side
effects, cascades — that belong to the application rather than the admin.
Express those as an endpoint invoked by an `httpCall` action (DECISIONS #010).

## Compatibility

The definition is a public contract. Within a major schema version, changes are
additive: new optional keys, new enum members behind new keys. Anything that
would invalidate an existing definition ships as a new `schemaVersion`.
