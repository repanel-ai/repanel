# RePanel definition schema — v0 (`schemaVersion: "0.1"`)

A **definition** describes an admin interface: which resources exist, what their
fields mean, how they relate, how they are listed and shown, and which actions
an operator may run. A coding agent writes it, RePanel validates and renders it.

It expresses *intent*, never layout. There is no component tree, no styling, no
branching — the runtime owns presentation. A resource is **read-only until it
says otherwise**: writes are opt in, per resource and per field, and a
definition that says nothing about them offers none.

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
| `navigation` | yes, ≥1 | Ordered sidebar groups. Between them they name every resource, exactly once. |
| `resources` | yes, ≥1 | Every resource the admin exposes. |

The `resources` array is elided above; a complete, valid definition lives in
`@repanel/contracts/fixtures`.

Unknown keys are rejected everywhere — a typo is an error, never a silently
ignored setting.

## Navigation

An ordered list of groups; each group lists resource keys in display order.

```json
{ "label": "Commerce", "resources": ["orders"] }
```

**Every resource appears in navigation, exactly once.** The sidebar is built
from these groups and from nothing else, so a resource no group lists is offered
nowhere: it validates, it is served, and an operator never sees that it is
there. A resource two groups list is the mirror image — two entries onto one
page. Both are validation errors: an unlisted resource is reported at the
resource, a repeated one at the entry that repeats it.

The group label is free text.

## Resource

A resource binds one postgres table to one admin section.

```json
{
  "key": "users",
  "label": { "singular": "User", "plural": "Users" },
  "source": { "table": "users" },
  "primaryKey": "id",
  "labelField": "email",
  "writes": { "create": true, "update": true },
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
| `primaryKeyGeneration` | no (default `database`) | Where a new record's key comes from: `database` or `client`. Only meaningful where `writes` offers `create`. See [Writes](#writes). |
| `labelField` | no (default `primaryKey`) | Field key a record is displayed by. Must not be `sensitive`, `hidden`, `json` or `relation`. |
| `icon` | no (default `table`) | The mark navigation draws this resource with, from the fixed vocabulary below. |
| `writes` | no (default none) | Which writes this resource offers: `create`, `update`, or both. See [Writes](#writes). |
| `readOnly` | no | What every resource said before `writes` existed: this one offers no writes. Only `true` is meaningful; a resource offering a form leaves it out. |
| `fields` | yes, ≥1 | Columns the admin knows about. |
| `relationships` | no (default `[]`) | Links to other resources. |
| `views` | yes | The table view and the detail view. |
| `actions` | no (default `[]`) | Operator-triggered writes. |

`labelField` is what a human reads instead of a record. A table showing a
relation column renders the target's label rather than its raw foreign key, and
every link to a record is titled with it. Left out, it falls back to
`primaryKey` — always present, and almost never what anyone recognizes a record
by, so setting it is worth the one line.

`icon` is one name from a closed vocabulary:

```
user      users     building  key       shield    cart      receipt   credit-card
package   truck     tag       wallet    file      folder    image     book
message   mail      database  webhook   terminal  activity  bell      clock
calendar  settings  chart     globe     link      table
```

The runtime draws every glyph itself, so a name it cannot draw is a name it
cannot honour — which is why the vocabulary is closed rather than free text, and
why an unknown name is a validation error listing all thirty. Left out, a
resource wears `table`: the runtime never reads a resource key and decides what
it looks like, any more than it reads a value and decides how grave it is.

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
  A hidden field may still be `editable`: a form is a detail surface.

Two more, also defaulting to `false`, are about writing rather than showing:

```json
{ "key": "title", "label": "Title", "type": "text", "editable": true, "required": true }
```

- `editable` — an operator may write this column from a form.
- `required` — the field must carry a value: on create it has to be supplied and
  cannot be null; on update it may be left out, which changes nothing, but may
  never be set to null. Only meaningful on an `editable` field.

## Writes

A resource offers writes by saying so, and a field is writable by saying so.
Both halves are required, and neither is inert on its own — a field marked
`editable` on a resource that offers no write is a validation error, not a
leftover.

```json
{
  "key": "job_openings",
  "writes": { "create": true, "update": true },
  "fields": [
    { "key": "id", "label": "ID", "type": "text" },
    { "key": "title", "label": "Title", "type": "text", "editable": true, "required": true },
    { "key": "status", "label": "Status", "type": "enum", "values": ["draft", "open"], "editable": true }
  ]
}
```

| Key | Required | Meaning |
|---|---|---|
| `writes.create` | no (default `false`) | An operator may add a record. |
| `writes.update` | no (default `false`) | An operator may change a record. |

The two are separate because they are separate decisions: a table whose rows are
created by the application and corrected by an operator offers `update` and not
`create`. There is no `delete` — removing a record is a rule-bearing act, and it
waits for the audit log that would make it accountable.

**Which types a form can write.** Every type but `json`:

`text` · `longText` · `number` · `boolean` · `date` · `dateTime` · `email` ·
`url` · `enum` · `relation`

A `json` field cannot be `editable`. A blob has no single input that fits it and
the shape inside it belongs to the application, so editing one is an endpoint
reached by an `httpCall` action (DECISIONS #010).

**What a value has to be.** Nothing is coerced. A value is the type its field
declares or the write is refused — an admin that reads `"false"` as false, or an
empty box as null, writes something nobody typed.

| Type | Accepts |
|---|---|
| `text`, `longText` | A string. `""` is a value; it is refused only where the field is `required`. |
| `email` | A string; an address when it is not empty. |
| `url` | A string; an absolute `http(s)` URL when it is not empty. |
| `number` | A number, or the digits of one as a string — what a `numeric` or `bigint` too large for JSON comes back as on a read goes back the same way, bound exactly as sent. |
| `boolean` | `true` or `false`. Never `"true"`, never `1`. |
| `date` | `YYYY-MM-DD`, and a day that is on the calendar. |
| `dateTime` | ISO 8601, with `Z` or an offset where the column keeps one and without where it does not. Nothing is shifted between zones. |
| `enum` | One of the field's own `values`. |
| `relation` | The key of the record to point at, or `null`. Whether that record exists is the foreign key's answer, not the schema's. |

`null` is accepted for any editable field that is not `required`. A key that
names no field, a field that is not `editable`, a `sensitive` field and the
`primaryKey` are each refused with the path of the field they name, so a form
can put the message under the input it belongs to.

**What a write answers with.** The record as it now stands, in the same shape a
detail read returns: sensitive fields absent, hidden fields present, relations
carrying their label. A create is answered with the key the database issued.

**Where a new record's key comes from.** `primaryKeyGeneration` says it, and a
resource that says nothing says `database`.

| Value | Meaning |
|---|---|
| `database` (default) | The column has a default and the admin never sends a key. An insert leaves the column out, the database generates, and the key it issued comes back with the record. The `primaryKey` field cannot be `editable`, and a create carrying a key is refused. |
| `client` | The key is chosen rather than generated — a slug, an account number, an id your application mints. The `primaryKey` field may be `editable`, the create form asks for it, and the insert writes it. |

It is a declaration of intent and nothing more. The definition never names a
generation algorithm: whether the default behind a `database` key is a sequence,
a `uuid`, or a trigger is your schema's business, and RePanel writing it down
would be RePanel guessing at it.

**A key is written once, or not at all.** Under either value an update refuses
the `primaryKey`: it addresses the record being changed, and moving it would
move the address of the form doing the changing. And because generation is a
question only a new record asks, declaring `primaryKeyGeneration` on a resource
whose `writes` do not offer `create` is a validation error.

What still cannot be created from the admin is a table with a `not null` column
that has no default and is not editable, which the database will say when the
write lands.

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
| `relatedLayout` | no (default `inline`) | `inline` \| `tabs` — whether related records are read alongside the record or reached from it. |

A related list may name either kind of relationship. The runtime renders it as
the target resource's table view — the target's columns, search, filters and
sort — so a `hasMany` list is a page of records and a `belongsTo` list shows at
most one.

`relatedLayout` says what the related records *are* to this resource, not how to
draw them. `inline` stacks them under the record's own sections: they are part
of reading the record. `tabs` gives the sections one tab and every related list
its own: they are their own subject, reached deliberately. A user's orders are
often the reason the user was opened; an organization's members are a list you
go and look at, and only the author knows which. Asking for `tabs` while naming
no related lists is an error — one tab is a page.

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

Business logic belongs in the customer's application: anything multi-step, or
conditional beyond the single comparison `visibleWhen` allows, is an endpoint
invoked by `httpCall`, not configuration here.

### `visibleWhen`

An action may state one precondition, and is then offered only on a record that
meets it — so an operator is not handed a button whose only answer is a refusal.

```json
{
  "key": "approve",
  "label": "Approve",
  "confirm": "Approve this airline? They can post openings immediately.",
  "visibleWhen": { "field": "approval_status", "equals": "pending" },
  "kind": "httpCall",
  "method": "POST",
  "url": "https://api.crewbase.example/repanel/airlines/{id}/approve"
}
```

It names a field of the same resource and says exactly one thing about it —
never both forms, never neither:

| Form | Holds when |
|---|---|
| `{ "field": …, "equals": <string, number or boolean> }` | the field holds exactly that value; nothing is coerced across types |
| `{ "field": …, "isSet": true }` | the field is not null — for a `relation`, that it points at a record |

`equals` may name a `text`, `enum`, `boolean`, `number`, `email` or `url`
field, and states a literal of that field's own type: a string for `text`,
`email` and `url`, a number for `number`, `true` or `false` for `boolean`, and
for an `enum` one of its declared `values`. Nothing is coerced across types —
`"3"` is not `3`, and `"true"` is not `true`.

`equals` against a `relation`, `json`, `date`, `dateTime` or `longText` field is
refused. None of those holds a value one literal names reliably, so the
comparison would parse and then never hold: an action nobody is ever offered,
with nothing anywhere to say why. Ask instead that the field is set, or state
the rule in the endpoint the action calls. `isSet` is legal on every field type.

The field may not be `sensitive`: whether a button is drawn is visible to
everyone who opens the record, so a condition on a secret answers questions
about it one record at a time. A `hidden` field is allowed — a precondition
reads a value, it never renders one.

**`visibleWhen` decides what is drawn, and nothing else.** The server does not
enforce it: an action is run by key, and what refuses it is what refused it
before — validation and the target column for a `dbUpdate`, the customer's own
endpoint for an `httpCall`. State the rule where it is enforced and describe it
here; never move it here.

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

- every resource is named by exactly one navigation entry: none unreachable,
  none listed twice;
- every navigation entry, column, sort field, search field, filter field,
  section field, related list, relationship target, relation-field target,
  primary key, label field, `dbUpdate` field, `httpCall` URL placeholder and
  `visibleWhen` field names something that exists;
- resource, field, relationship and action keys are unique;
- a `belongsTo` foreign key exists on the declaring resource, a `hasMany`
  foreign key on the target;
- searchable fields are text-typed and filter kinds match field types;
- a detail view asking for the `tabs` layout names at least one related list;
- sensitive fields never appear as table columns, search fields, filters or
  the default sort, never inside an `httpCall` URL template, never decide
  whether an action is offered, and are never a resource's primary key, its
  label field, or a relationship's foreign key;
- hidden fields never appear as table columns, search fields, filters, the
  default sort or the label field — detail sections may still use them;
- a label field reads as a name: never a `json` or `relation` field;
- a `dbUpdate` targets only a non-sensitive `enum` or `boolean` field, and
  writes one of the enum's values or a boolean literal;
- a field marked `editable` belongs to a resource that offers a write, is not
  `sensitive`, is not a `json` field, and is not the `primaryKey` unless that
  resource's `primaryKeyGeneration` is `client`; a resource that offers a write
  marks at least one field `editable`; `required` appears only on an `editable`
  field;
- `primaryKeyGeneration` appears only on a resource whose `writes` offer
  `create` — where a key comes from is a question only a new record asks;
- `readOnly` is never `false`, and never accompanies a `writes` that offers
  anything — a resource says what it offers, not what it is not;
- a `visibleWhen` states exactly one of `equals` or `isSet`; an `equals` names a
  field of a comparable type and states a literal of that field's own type —
  on an `enum` field, one of its declared values;
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

**Forms are last-write-wins.** An update writes the fields it names over
whatever is there. There is no optimistic concurrency in v0: nothing carries a
version, nothing is compared before writing, and when two operators edit the
same record the second save wins and the first is not told. Where a record
cannot afford that, the write belongs behind an endpoint that can decide —
`httpCall`, with the rule in your application.

**No delete.** v0 creates and updates records; it never removes one. Deleting is
a rule-bearing act — what cascades, what is archived instead, what an operator
may undo — and it waits for the audit log that would make it accountable.
Express it as an endpoint invoked by an `httpCall` action.

**A relation is edited by its key.** An `editable` relation field renders as a
box an operator types the target record's key into — there is no picker and no
search-by-name. The form shows what the key currently points at, by the label
the read view uses, for as long as the key is the one the record came with; a
key that points at nothing is refused by the database and the refusal lands on
that field. Where an operator could not reasonably know the key, the honest
answer today is to leave the relation closed and set it from your application.

**No bulk edit, and no file or image fields.** A form writes one record, and
every value it writes is JSON.

**`json` fields are read-only.** A `json` field renders as inspectable JSON and
is never `editable`; see [Writes](#writes).

**Preconditions.** `visibleWhen` is one comparison against one field of the same
record, and there is no `and`, no `or`, no negation and no comparison between
two fields. There is also no way to say why a record was passed over — an action
that does not apply is simply absent. Anything more is a rule, and a rule lives
in the endpoint the action calls (DECISIONS #010).

**No negative form.** `isSet` is only ever `true`; there is no `isSet: false`,
and no `notEquals`. This is a deferral rather than an oversight: the ladder in
#010 grows one rung at a time, and the positive rung is the one checkpoint D
asked for. A negative reads as a rule far more often than a positive does —
"not approved" is usually several states rather than one — so it is worth
seeing asked for before it exists. Until then, say the positive case, or state
the rule in the endpoint (DECISIONS #039).

## Compatibility

The definition is a public contract. Within a major schema version, changes are
additive: new optional keys, new enum members behind new keys. Anything that
would invalidate an existing definition ships as a new `schemaVersion`.
