# Authoring a RePanel definition

**This document is written for a coding agent.** You are working inside a
customer's repository, with access to their code and their RePanel project
through the `repanel` MCP server. Your job is to read the application, write a
definition that describes the admin it deserves, submit it, and repair it until
it is valid.

The definition is the whole deliverable. There is no admin code to write: you
describe intent — which resources exist, what their fields mean, how they
relate, what an operator may do — and RePanel's runtime renders it.

`get_schema_documentation` is the authority on **what the definition may
contain**. This document is about **how to decide what to put in it**: how to
read an application, how to classify a column you have never seen before, and
what to do when the answer is not in the definition at all.

---

## The loop

1. **Inspect** the application: schema, enums, relations, sensitive columns, and
   any admin-API endpoints it already has.
2. **Check the project** with `get_project`. It tells you the project's name and
   key, whether a database connection exists (`hasConnection`), and whether a
   definition is already there.
3. **Read `get_schema_documentation`.** Every time. It is short, it is the
   contract, and unknown keys are rejected everywhere — a definition written
   from memory of an older schema fails on keys that no longer mean anything.
4. **Author** the definition into `repanel/` in the customer's repository (the
   layout is below). It is their file, in their review, under their history.
5. **Submit** the composed object with `submit_definition`.
6. **Repair.** An invalid submission comes back with every problem found, each
   carrying a path, an expectation and a fix. Apply them, submit again, repeat
   until `valid` is true. Invalid drafts are stored, so nothing is lost, and
   `get_validation_result` resumes the loop in a later session.

Then hand back: say what you exposed, what you deliberately hid, and which
decisions a human should look at. The last part matters more than it sounds —
you are the only one who saw both the schema and the definition.

---

## 1 · Inspect the application

Read the source of truth for the schema, not a dump of the database: migrations,
an ORM schema, model files. You are looking for six things.

**Tables worth administering.** Not every table is a resource. Join tables with
no data of their own, framework bookkeeping (`migrations`, `sessions`, job
queues, caches) and event logs nobody reads one row of are noise in a sidebar.
A resource is something an operator would go looking for.

**Enums.** A database enum, a check constraint or an ORM union type gives you a
field's `values` exactly. Never guess them from the rows that happen to exist —
a status nobody has reached yet is still a status.

**Relations.** Foreign keys tell you both the `relation` fields (a column that
points at another record) and the `relationships` (how to travel between
records). A record's detail page is worth ten times more with its related lists
on it.

**Columns that must never be rendered.** Credentials, tokens, keys. See §4.

**Columns that are not what they look like.** Soft deletes, internal JSONB,
denormalized caches, counters maintained by triggers.

**Existing admin-API endpoints.** Search the routes for a `/repanel` prefix, and
more generally for endpoints that already perform operator-shaped work:
`approve`, `refund`, `resend`, `suspend`, `retry`. Every one you find is an
action you can offer without writing any application code (§5).

Also read the application's *language*. A table called `orgs` whose UI says
"Workspaces" is a resource labelled Workspace/Workspaces. The definition is
read by operators, not by the schema.

---

## 2 · Connect — and never touch a secret

RePanel needs a connection string to the customer's database. **It must never
pass through you.** Do not ask for a DSN in chat, do not read one out of a
`.env` file to send onward, and do not put one in a file you write. The same
goes for the project's action secret (§5): it is revealed once, to a signed-in
human, in the console.

This is not a formality. Anything you handle is in a transcript.

When `get_project` answers `hasConnection: false`, stop and hand the job to a
human:

> SkyScout's RePanel project has no database connection yet. Open the project in
> the RePanel console — `https://<console-host>/p/<project-id>`, the
> **Connection** section — and paste the connection string there. It is stored
> encrypted and never leaves RePanel. Tell me when it is saved and I will carry
> on.

You will usually not have the project id: your token names the project, not its
URL. Then name the project instead — "the project called *SkyScout* in the
console" — and let them click through from the project list.

A `repanel link` CLI arrives at MVP and does this handshake without the
copy-paste: it opens the console, the human pastes the DSN once, and the agent
is told only that a connection now exists. Until then, the deep link and the
sentence above are the pattern.

Everything else you can do while you wait: you can inspect the repository,
classify every column and write the definition before a connection exists.
Validation does not need one. Only the rendered admin does.

---

## 3 · Where the definition lives

The definition belongs in the customer's repository, in a `repanel/` directory
at the root. **RePanel is the execution truth; the file is the reviewable
source** — the same relationship a Terraform file has to what is deployed.

The standard layout is multi-file:

```
repanel/
  app.json                 schemaVersion, app, navigation
  resources/
    users.json             one resource object per file
    airlines.json
    candidates.json
    job_openings.json
    applications.json
```

`app.json` holds everything except the resources:

```json
{
  "schemaVersion": "0.1",
  "app": { "name": "SkyScout Admin" },
  "navigation": [
    { "label": "Marketplace", "resources": ["airlines", "job_openings"] },
    { "label": "People", "resources": ["candidates", "applications", "users"] }
  ]
}
```

Each file under `resources/` holds **one resource object** — the same object
that would appear in the `resources` array — and **the filename is the resource
key**: `candidates.json` contains the resource whose `"key"` is `"candidates"`.
Nothing enforces that; it is what makes the directory readable at a glance and
what lets a reviewer find the file a validation error is about.

A single-file `repanel/definition.json` holding the whole object is equally
valid, and is the right choice for a small app — three resources do not need a
directory. It is a degenerate case of the same convention, not a different one.

### Assembly

**A submission is always one composed object.** `submit_definition` replaces the
entire draft; there are no partial updates and no per-resource submissions. So:

1. read `repanel/app.json`,
2. read every file in `repanel/resources/` in a stable order — sort by filename,
3. compose `{ ...app, resources: [ …each resource object… ] }`,
4. pass that to `submit_definition`.

Keep the order stable between submissions. Validation errors are reported at
paths like `resources[2].views.table.columns[5]`, and an index that means a
different resource each time you submit is an index you cannot act on.

A CLI will do this assembly at MVP. Until it exists, you assemble in memory
before calling the tool — and you still write the files, because the files are
what the customer reviews, versions and comes back to in six months.

---

## 4 · Classify every column

This is the part that decides whether the admin is safe. Go column by column.
The rules are short and none of them are advisory.

### Credentials are `sensitive`

Any column holding a secret — `password_hash`, `password`, `api_key`,
`access_token`, `refresh_token`, `secret`, `otp_code`, `recovery_codes`,
`card_number`, `ssn` — is marked `sensitive: true`, and appears in no view.

```json
{ "key": "password_hash", "label": "Password hash", "type": "text", "sensitive": true }
```

A sensitive field is never selected from the database at all, so it cannot leak
through a table, a search box, a filter, a sort order, a URL template or a
detail page. Declare it and leave it out of every view: declaring it is how the
definition records that you saw the column and contained it.

**A hash is not "safe because it is hashed".** It is an offline cracking target
and a fingerprint that says two accounts share a password. The same goes for a
token that looks expired: expiry is the application's opinion, not the column's.

Ask one question per column: *if this value appeared on a screen behind a shared
login, would that be a problem?* If yes — `sensitive`.

### `hidden` is a display choice, `sensitive` is a security one

Do not use one for the other. `hidden` keeps a field off lists but it is still
read and still shown on the record's detail page. `sensitive` means the value
never leaves the API. A hidden password hash is a leaked password hash.

### Internal JSONB is `hidden`, or detail-only

A JSONB column written by and for internal code — scoring, feature flags,
working notes, a provider's raw webhook payload — has an unstable shape and an
internal audience. It has no business being a table column.

- Operators sometimes need to read it → declare it `"type": "json"` and put it
  in a **detail section only**. RePanel renders it as inspectable JSON.
- Nobody outside engineering reads it → `"hidden": true`.

Either way it stays out of `columns`, `search` and `filters`.

### Soft deletes are `hidden` — and say so out loud

A `deleted_at`, `archived_at` or `is_deleted` column means rows that the product
considers gone are still in the table.

```json
{ "key": "deleted_at", "label": "Deleted at", "type": "dateTime", "hidden": true }
```

**Known v0 gap: RePanel cannot filter them out by default.** There is no
resource-level default scope in the schema, so the list will include
soft-deleted records. Marking the column `hidden` keeps the flag off the list
without hiding the rows themselves. Two things follow:

1. Do not pretend otherwise. Tell the human, in your summary, that soft-deleted
   rows appear in the list and that the column is hidden rather than filtered.
2. If it matters enough, the honest workaround is a database **view** of the
   live rows, bound as the resource's `source.table`. That is a change to the
   customer's database, so propose it — never make it silently.

### A status with rules is read-only, plus an action

v0 resources are read-only, so nothing you write makes a status editable. The
mistake is subtler: leaving the status as an ordinary field when an operator's
whole job is to *move* it, or wiring a raw `dbUpdate` at a column that has rules
behind it.

Decide with one question: **is there a rule about who may move it, when, or what
else happens?**

- **Yes, and an endpoint exists** → `httpCall` at that endpoint. The application
  enforces its rule and answers.
- **Yes, and no endpoint exists** → you write the endpoint (§5). This is the
  normal case, not an escalation.
- **No — the flip is genuinely rule-free** → `dbUpdate` is honest and costs the
  customer nothing.

`dbUpdate` writes one literal to one `enum` or `boolean` column. That is all it
can do, on purpose: anything with a condition, a second write or a side effect
is business logic, and business logic lives in the application (DECISIONS #010).

Give the enum a `tones` map while you are there — the runtime has never seen the
customer's vocabulary and will not guess which values are alarming.

### Everything else: pick the type that says the most

`email` and `url` render as links; `dateTime` renders in one fixed shape; a
foreign key becomes a `relation` field so the table shows the target's label
instead of a UUID. A `text` column that holds an email is a missed opportunity
in every row of the table.

---

## 5 · Actions, and the endpoints behind them

**Prefer an existing `/repanel/*` endpoint over `dbUpdate`, every time.** An
endpoint has the rule in it, is tested and reviewed in the customer's
repository, and keeps working when the rule changes. A `dbUpdate` pointed at a
column with a rule behind it is a bug you shipped in configuration.

When the endpoint does not exist yet, write it — you are in the repository
already. The convention (DECISIONS #013):

- **One module**, mounted at `/repanel`, holding every endpoint RePanel may
  call. Not routes scattered across the app.
- **One verification middleware** in front of all of it, and nothing else behind
  it. The scheme is [`SIGNING.md`](SIGNING.md): an HMAC over
  `<timestamp>.<METHOD> <URL>` under the project's action secret, compared in
  constant time, with a five-minute tolerance. That document carries a working
  verifier — copy it, do not reinvent it from this paragraph.
- **The secret comes from the application's own secret store**, conventionally
  `REPANEL_ACTION_SECRET`. You scaffold the code that reads the variable; the
  human pastes the value into the console and into their secret store (§2).
- **Any 2xx is success.** Nothing from the response body reaches the operator,
  so put the detail in your own logs. Refusals are status codes: `409` for "the
  record cannot do that", `404` for "no such record".
- **Answer `200`, not `201`**, when nothing was created.

`examples/skyscout/src/repanel/` in the RePanel repository is a complete worked
example of exactly this: middleware, one endpoint, and the rule in the feature
that owns it rather than in the controller.

Then the action is four lines of definition:

```json
{
  "key": "approve",
  "label": "Approve",
  "confirm": "Approve this airline? They will be able to post openings immediately.",
  "kind": "httpCall",
  "method": "POST",
  "url": "https://api.skyscout.example/repanel/airlines/{id}/approve"
}
```

`{field_key}` placeholders are filled from the record, and never from a
sensitive field. Write `confirm` as a sentence that tells an operator what will
actually happen — it is the last thing they read before it happens.

---

## 6 · Submit and repair

Send the composed object. Read the errors as a work list, not as a verdict:
each one carries `path`, `message`, `expected` and `hint`, and the hint is a
concrete fix.

Two rules about repairs:

**Never widen an exposure to satisfy the validator.** If a containment error
says a `sensitive` field cannot be a table column, the fix is to remove the
column — never to unmark the field. Hints deliberately never offer that door
(DECISIONS #015); do not find it yourself. If you genuinely believe a field was
misclassified, say so to the human and let them decide.

**Fix structure before meaning.** A structural failure — a bad type, an unknown
key — skips the referential pass entirely, so the first submission after a
malformed one usually surfaces a second wave of errors. That is the checker
working, not a regression.

When it validates, write the final files, and tell the human what you decided:
the resources you left out, the columns you marked sensitive or hidden, the
actions you added and the endpoints you wrote for them, and any known gap you
worked around.

---

## Platforms

Stack-specific notes. The definition itself is stack-neutral: nothing below
changes what you may write, only where to look for it.

### NestJS

- **Schema.** With Drizzle, `*.schema.ts` or a `db/schema/` directory —
  `pgEnum(...)` gives you a field's `values` verbatim and `.references(...)`
  gives you the relationships. With TypeORM, `@Entity()` classes; with Prisma,
  `schema.prisma`. Prefer any of these to a live introspection: they carry the
  intent, including which columns are soft deletes.
- **Existing endpoints.** Controllers are the route table: grep for
  `@Controller(` and read the `@Post`/`@Patch` methods. An existing
  `/repanel`-prefixed controller means the convention is already in place and
  you are adding a route to it, not scaffolding a module.
- **Where the rules are.** Services, not controllers. If a status transition has
  a guard clause in a service, that guard is your evidence that the column needs
  an action rather than a `dbUpdate`.
- **Scaffolding the admin module.** A feature module with one controller, plus
  `configure(consumer)` applying the signature middleware to the `/repanel`
  prefix — bound to the prefix, not to a list of routes, so a later endpoint
  cannot join the module unprotected.
- **Monorepo.** In a pnpm/Nx workspace the API is usually `apps/api`; the
  `repanel/` directory still belongs at the **repository root**, because the
  definition describes the product, not one package.

### Supabase

- **Use the session pooler connection string.** In the dashboard, Connect →
  Session pooler: a `…pooler.supabase.com` host on port `5432`, with the user
  `postgres.<project-ref>`. Copy it from there rather than assembling it. The direct connection is IPv6-only on many projects
  and RePanel will not reach it, and the transaction pooler (port `6543`) does
  not promise to keep session state — RePanel sets a `statement_timeout` on
  every connection it opens (DECISIONS #024), and that is session state.
- **`auth.users` is referenced, not administered.** A resource binds to a table
  by bare name, so a schema-qualified table cannot be named at all in v0 — and
  that is the right outcome. Supabase owns that table. The real user resource is
  the application's own profile table, usually `public.profiles`, one row per
  auth user. Bind that, and treat the auth id as an ordinary field.
  Anything that administers the account itself — resetting a password, banning,
  deleting a user — goes through Supabase's admin API from an endpoint in the
  customer's application, invoked by an `httpCall` action. Never a `dbUpdate`
  against an auth table.
- **RLS is not the protection layer here.** RePanel connects as a database role.
  If that role is the one Supabase gives you by default, row-level security does
  not apply to it, and if you restrict it, RLS will quietly hide rows the
  operator needs and the admin will look broken rather than secure. Either way,
  what protects this surface is the definition: `sensitive` containment,
  `hidden` fields, read-only resources, and actions that go through the
  application. Classify the columns as if nothing else were guarding them —
  because nothing else is.

## Integrations

Reserved. Curated recipes for putting a third-party endpoint behind an action —
the widget-shaped patterns that are worth having one blessed answer for — land
here after MVP. Until then, anything external is an endpoint in the customer's
application (§5), which is also what those recipes will generate.
