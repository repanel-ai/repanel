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
5. **Run it locally** with `repanel dev` if the CLI is installed (§8). It is a
   faster loop than submitting, it needs no project and no account, and it
   shows you the admin instead of telling you the definition parsed.
6. **Submit** the composed object with `submit_definition` — or, where the CLI
   is installed and the repository is linked, with `repanel deploy` (§7).
7. **Repair.** An invalid submission comes back with every problem found, each
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
action you can offer without writing any application code (§6).

Also read the application's *language*. A table called `orgs` whose UI says
"Workspaces" is a resource labelled Workspace/Workspaces. The definition is
read by operators, not by the schema.

---

## 2 · Connect — and never touch a secret

RePanel needs a connection string to the customer's database. **It must never
pass through you.** Do not ask for a DSN in chat, do not read one out of a
`.env` file to send onward, and do not put one in a file you write. The same
goes for the project's action secret (§6): it is revealed once, to a signed-in
human, in the console.

This is not a formality. Anything you handle is in a transcript.

When `get_project` answers `hasConnection: false`, it also answers
`connectionSetupUrl`: the console page for this project, on this deployment.
Stop and hand the job to a human, with that link:

> Crewbase's RePanel project has no database connection yet. Open
> <connectionSetupUrl>, the **Connection** section — and paste the connection
> string there. It is stored encrypted and never leaves RePanel. Tell me when it
> is saved and I will carry on.

Pass the URL through verbatim. Once a connection exists the field is `null`,
which is how you know not to send anyone anywhere.

### Better: offer to run `repanel link`

Where the CLI is installed, there is a shorter path, and **you may run it
yourself**:

```
repanel link
```

It signs the machine in through the human's browser, asks which project this
repository belongs to, reads `DATABASE_URL` out of the application's own
environment, shows it as `host/database` with the password taken out, and asks
`Connect …? [Y/n]` in the terminal. On yes it sends the connection string
straight to RePanel over that browser session. Then it writes
`.repanel/project` — the project key, nothing else — for the human to commit.

**Running it is not handling the secret, and the difference is built in.** The
connection string goes from the environment to the API and nowhere else: it is
never printed, never written to a file, and it cannot be passed as an option,
because a connection string on a command line is a connection string in a shell
history. You never see it. What you see is the command's output, which names
the host and the database and no credential.

Two rules about running it:

- **You may not answer its questions.** Where there is no terminal it refuses
  rather than assuming; that refusal is the safety property working, not an
  obstacle to route around.
- **Never try to give it a DSN.** It takes none, on purpose. If you find
  yourself wanting to, you are about to do the thing this section forbids.

Say what you are about to do, run it, and read the result:

> Crewbase's RePanel project has no database connection yet. I can run
> `repanel link` — it will ask you which project, then show you the database
> from your `.env` and ask you to confirm before connecting it. The connection
> string stays between your machine and RePanel; I never see it.

Where the CLI is not installed, the deep link and the sentence above it are the
pattern.

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
  "app": { "name": "Crewbase Admin" },
  "navigation": [
    { "label": "Marketplace", "resources": ["airlines", "job_openings"] },
    { "label": "People", "resources": ["candidates", "applications", "users"] }
  ]
}
```

**Every resource file is named in exactly one group.** The sidebar is built from
`navigation` alone, so a resource no group lists is offered nowhere — validation
refuses it rather than letting it be served to nobody. If a table does not
belong in the sidebar, it does not belong in `resources/` either.

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

`repanel deploy` performs exactly this assembly and submits the result, so
where the CLI is installed it is the shorter path (§7). Where it is not, you
assemble in memory before calling the tool. Either way you write the files,
because the files are what the customer reviews, versions and comes back to in
six months.

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

### A status with rules is moved, not typed

A status is the classic case for an action rather than a form field. The mistake
is subtler than marking it `editable`: it is leaving the status as an ordinary
field when an operator's whole job is to *move* it, or wiring a raw `dbUpdate`
at a column that has rules behind it.

Decide with one question: **is there a rule about who may move it, when, or what
else happens?**

- **Yes, and an endpoint exists** → `httpCall` at that endpoint. The application
  enforces its rule and answers.
- **Yes, and no endpoint exists** → you offer to write the endpoint (§6). This
  is the normal case, not an escalation.
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

## 5 · Editable is a decision, not a default

A resource offers no writes until it says so, and a column is not writable until
it says so too:

```json
{
  "key": "job_openings",
  "writes": { "create": true, "update": true },
  "fields": [
    { "key": "title", "label": "Title", "type": "text", "editable": true, "required": true },
    { "key": "status", "label": "Status", "type": "enum", "values": ["draft", "open", "closed"], "editable": true },
    { "key": "created_at", "label": "Created", "type": "dateTime" }
  ]
}
```

Both halves are required and neither is inert: `editable` on a resource with no
`writes` is a validation error, and so is a `writes` with nothing editable under
it. That is deliberate. A half-written opt-in is an author who believes they
opened a form, and a blank screen is the worst way to find out otherwise.

**When in doubt, an action or an endpoint.** Reading is safe and writing is not,
so the burden of proof sits on the write. Before you mark a column `editable`,
ask what happens when somebody types into it:

- **A rule decides who may change it, when, or what else happens** → not
  editable. It is an `httpCall` at an endpoint (§6), or a `dbUpdate` if the flip
  is genuinely rule-free.
- **The application owns the value** — counters, timestamps, derived totals,
  soft-delete columns, anything a job writes → not editable. An operator typing
  over it produces a number that is wrong until the next run.
- **It is a secret** → not editable, and not negotiable. A form would have to
  render what is there before anyone could change it.
- **It is plain data the operator is the authority on** — a name, a title, a
  note, a contact address, which record something points at → editable. This is
  the case forms exist for.

**`required` means the database will insist.** Mark a field `required` when its
column is `not null` and has no default; leave it off when the column is
nullable or defaulted, so an operator can leave the box empty and let the
default apply. Getting this wrong is not dangerous — the database refuses the
write and the operator is told which field — but getting it right means they are
told before they press save.

**A resource is creatable only if the database can fill in the rest.** Every
`not null` column with no default has to be either `editable` or supplied by the
application. A table whose `password_hash` is `not null` cannot be created from
an admin — offer `update` alone and let the application create the row:

```json
"writes": { "update": true }
```

That is the common shape, not a fallback. Most records are created by the
product and corrected by an operator.

**The database issues the key unless you say otherwise.** `primaryKeyGeneration`
defaults to `database`: the insert leaves the key column out, the column's own
default fills it in — a `uuid`, a sequence — and the key it issued comes back
with the record, so the form never asks for one. Where the key is chosen rather
than generated — a slug, an account number, an id your application mints — say
so and open the column:

```json
"primaryKeyGeneration": "client",
"fields": [{ "key": "slug", "label": "Slug", "type": "text", "editable": true, "required": true }]
```

Check the column before you write either one: a key column with no default and
`primaryKeyGeneration: "database"` fails on the first create, and the operator
is told about a column they cannot fill in. An edit form never shows the key
whichever you declare — a key addresses the record and is chosen once.

**An editable relation is typed as a key.** There is no picker and no
search-by-name in v0: the form shows a box, and the operator puts the target
record's key in it. It shows what the key currently points at, by the same label
the table and the record page use, so an operator can see what they are about to
change — but they cannot look one up from here. Where the key is not something
they could reasonably have to hand, leave the relation closed and set it from
your application.

**What you cannot do in v0:** delete a record, edit a `json` field, edit files
or images, or edit many records at once. And an update is last-write-wins —
there is no version check, so when two operators save the same record the second
one wins silently. Where that is not acceptable, put the write behind an
endpoint that can decide.

---

## 6 · Actions, and the endpoints behind them

**Prefer an existing `/repanel/*` endpoint over `dbUpdate`, every time.** An
endpoint has the rule in it, is tested and reviewed in the customer's
repository, and keeps working when the rule changes. A `dbUpdate` pointed at a
column with a rule behind it is a bug you shipped in configuration.

### When the endpoint does not exist yet, offer to write it

You are in the repository already, so it is a small job. It is still application
code in the customer's application, which is a different kind of change from a
definition file, and it is theirs to accept. Propose it and wait for a yes —
name the route, where it goes and what rule it carries:

> `candidates.status` moves under a rule — a candidate is verified only after
> screening — so this wants an action that calls Crewbase, not a `dbUpdate`.
> There is no endpoint for it yet. I can add
> `POST /repanel/candidates/:id/verify` to the existing `/repanel` module,
> behind the same signature middleware, with the rule in the candidates service
> and a `409` for a candidate that is not in `screening`. Shall I?

On a no, the definition says less and stays honest: leave the action out, and
tell the human what the admin therefore cannot do. Do not fall back to a
`dbUpdate` at a column with a rule behind it. That is the same bug, and asking
first does not make it a different one.

The convention, once you have the yes (DECISIONS #013):

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

`examples/crewbase/src/repanel/` in the RePanel repository is a complete worked
example of exactly this: middleware, one endpoint, and the rule in the feature
that owns it rather than in the controller.

Then the action is a few lines of definition:

```json
{
  "key": "approve",
  "label": "Approve",
  "confirm": "Approve this airline? They will be able to post openings immediately.",
  "visibleWhen": { "field": "approval_status", "equals": "pending" },
  "kind": "httpCall",
  "method": "POST",
  "url": "https://api.crewbase.example/repanel/airlines/{id}/approve"
}
```

`{field_key}` placeholders are filled from the record, and never from a
sensitive field. Write `confirm` as a sentence that tells an operator what will
actually happen — it is the last thing they read before it happens.

**Say when the action applies.** Where the endpoint refuses in some state — the
approve above answers `409` for an airline that is not `pending` — add a
`visibleWhen`, and the button is drawn only on records it would work on. This
repeats what the endpoint already knows; it never moves the rule. The endpoint
still refuses, and it is still the only thing that does.

`visibleWhen` says exactly one thing about one non-sensitive field of the same
resource: `equals` a value, or `isSet`. `equals` names a `text`, `enum`,
`boolean`, `number`, `email` or `url` field and states a literal of that field's
own type; a `relation`, `json`, `date`, `dateTime` or `longText` field can only
be asked whether it is set. Anything needing two conditions, a negative, a
comparison between two fields, or a reason to be given for the refusal is a
rule — put it in the endpoint, where it can be tested (DECISIONS #010).

---

## 7 · Submit and repair

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

### Or `repanel deploy`

Where the CLI is installed and the repository has been linked (§2), the whole
submission is one command, and it is another you may run yourself:

```
repanel deploy
```

It assembles `repanel/`, submits it to the linked project over the human's own
session, and reports the same problems in the same form — each in the file that
holds it — or, when it validates, the address of the admin it just described.
It carries no secret and invents no input: what it sends is the definition in
the repository, which is the one under review.

The loop is the same as above, one command shorter: repair the files, run it
again, read the work list until there is none.

---

## 8 · Work locally, before any of that

`repanel dev` runs the whole admin on the developer's machine — the real
renderer, the real query engine, their own database — with no RePanel account,
no project and no RePanel network call. Use it as the loop: it is faster than
submitting, and it shows you the admin rather than telling you the definition
parsed.

```
repanel dev
```

It reads `repanel/`, works out which database to use, and serves the admin at
`http://127.0.0.1:5170/a/local/`.

**It will not start on a definition that does not validate.** There is no admin
to show yet, so it prints the same problems `repanel validate` prints, opens no
port, and exits nonzero. Once it is up, a broken edit is a different matter —
see the overlay below.

The database is looked for in four places, in order: `--database-url`, then a
`DATABASE_URL` already exported in the shell, then `.env.local`, then `.env`. The
first two are taken as an answer and used. The two files are only a guess, so it
prints the DSN with the password masked and asks before connecting — and where
there is no terminal to ask at, it refuses rather than assuming. `--yes` accepts
the guess; naming the database outright with `--database-url` also needs no
terminal. `--port` moves the server.

**The overlay is your feedback channel, and it is the same output `repanel
validate` prints.** Every save under `repanel/` is reassembled and rechecked.
When it validates, the browser reloads. When it does not, the problems appear
as an overlay over the admin — file, path, message, expected, hint — and the
admin *underneath keeps working*, because a definition is only ever swapped for
one that validated. So a broken edit costs you nothing: the screen you were on
is still the screen you were on, and the overlay tells you what to change.

Read those problems the way §7 says to read a submission's: as a work list, and
never by widening an exposure.

**Actions are signed with a secret generated for that run.** It is printed once
when the server starts:

```
REPANEL_ACTION_SECRET=…
```

Put it in the application's environment and restart the application, or every
`httpCall` action is refused with a 401 — which is the verification in §6
working, not a bug. It is a new secret every run and it is never written to
disk: a development secret that persists is a development secret that
eventually ships.

`repanel dev` reaches nothing but the database it was given and the endpoints
your own actions declare. There is no RePanel account, and no RePanel service is
contacted, anywhere in this path.

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
application (§6), which is also what those recipes will generate.
