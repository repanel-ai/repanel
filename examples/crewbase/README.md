# Crewbase

A small aviation staffing marketplace, and RePanel's reference customer
application. It exists to be *administered*: a coding agent inspects this
repository, writes a RePanel definition from what it finds, and the resulting
admin is judged on whether it handled what is in here.

There is no UI. What Crewbase has is a database worth administering and one
admin-API module RePanel is allowed to call.

This page is the whole loop, end to end: run the application, let an agent write
its admin, run that admin three different ways, and keep working on it.

---

## The pieces, and where they run

Nothing here shares a port, so all of it can be up at once — which is the point.
Crewbase is a *customer's* application, and RePanel reaches it from outside.

| | What it is | Address |
|---|---|---|
| **Crewbase** | The customer application: ~200 seeded rows, one admin endpoint. | `localhost:3002` |
| **Crewbase's database** | Postgres in Docker. The one the admin reads. | `localhost:5433` |
| **`repanel dev`** | The whole admin, on your machine. No account, no network call. | `127.0.0.1:5170` |
| **RePanel's API** | The control plane. Only needed for the hosted paths. | `localhost:3001` |
| **RePanel's own database** | Postgres in Docker, separate from Crewbase's. | `localhost:5432` |
| **The console** | Sign-in, projects, connection, agent tokens. | `localhost:5173` |
| **The runtime** | The hosted admin's face. | `localhost:5174` |

There are three ways to serve Crewbase's admin, and they are three rungs of the
same ladder. Start at the top and stop wherever you like:

1. **[`repanel dev`](#2--the-admin-with-no-account)** — no account, no RePanel
   process, nothing leaves the machine.
2. **[Hosted, with a connection string](#4--the-admin-hosted)** — RePanel holds
   an encrypted DSN and dials your database.
3. **[Hosted, through a connector](#5--the-admin-hosted-without-handing-over-a-connection-string)** —
   RePanel holds no credential; a binary you run beside the database dials out.

---

## 1 · Run Crewbase

From the repository root:

```bash
pnpm install && pnpm -r build          # CONTRIBUTING.md has the prerequisites

cp examples/crewbase/.env.example examples/crewbase/.env
docker compose -f examples/crewbase/docker-compose.yml up -d   # postgres on 5433
pnpm --filter crewbase db:push
pnpm --filter crewbase seed        # 205 rows: 20 users, 12 airlines, 60 candidates, 28 openings, 85 applications
pnpm --filter crewbase dev         # http://localhost:3002
```

The build matters before anything else here: `repanel dev` serves the compiled
runtime that `pnpm -r build` produces, and it says so plainly if that copy is
missing.

`seed` is re-runnable: it truncates first, and the data is generated from a
fixed seed, so two people looking at Crewbase are looking at the same rows.

Crewbase itself only has to be running for the `approve` action
([below](#the-admin-api)). Everything else reads the database directly.

---

## 2 · The admin, with no account

```bash
pnpm --filter crewbase exec repanel dev     # http://127.0.0.1:5170/a/local/
```

That is the real product: the same runtime, the same engine, the same rendering
— reading Crewbase's database from your machine. There is no RePanel account, no
project, and no network call off the machine except the endpoints the definition
itself declares.

It finds `DATABASE_URL` in `.env` and shows it to you, with the password taken
out, before using it. It watches `repanel/` and reloads on every save; a
definition that does not validate appears as an overlay over the admin that was
already there, so a broken edit costs you nothing.

It also prints a `REPANEL_ACTION_SECRET` generated for that run. Put that value
in `examples/crewbase/.env`, restart `pnpm --filter crewbase dev`, and the
`approve` action works — see [the admin API](#the-admin-api) for why the
signature matters.

Leave both running in two terminals. That is the loop.

---

## 3 · Let an agent write the definition

`repanel/` in this directory already holds a finished definition. To watch an
agent produce one, move it out of the way first:

```bash
mv examples/crewbase/repanel /tmp/crewbase-definition
```

### The prompt

Point your agent at this repository and say:

```text
Read this app's schema and write a RePanel definition into repanel/.
```

That is genuinely enough when the [authoring skill](#the-authoring-skill) is
installed — the skill is what carries the rules about sensitive columns, soft
deletes, enums with workflows behind them, and when an action needs an endpoint
in the application rather than a direct write.

Without the skill, spell out the same job:

```text
Read this application's Drizzle schema in src/db/ and its admin API in
src/repanel/, then write a RePanel admin definition into repanel/ —
app.json for the app name and navigation, one file per resource under
repanel/resources/.

For every column decide what it is, not just what type it holds: which
are safe to show, which must never leave the API, which are internal
bookkeeping that belongs on a detail page at most. Where a status change
has a rule behind it, point an action at the endpoint that enforces the
rule instead of writing the column directly.

Then run `repanel validate` and fix everything it reports.
```

Ask for the read-back at the end. It is the part that matters:

```text
Tell me what you exposed, what you deliberately hid and why, and which
decisions I should look at myself.
```

### Growing it later

The same loop adds to a definition that already exists:

```text
Open create and edit forms on candidates: name, email and type editable,
and nothing else. Leave the workflow columns to the actions that move them.
```

```text
Add a related list of a candidate's applications to the candidate detail
page, and a filter on application status to the applications table.
```

### The authoring skill

[`skills/repanel/SKILL.md`](../../skills/repanel/SKILL.md) is
[`docs/AUTHORING.md`](../../docs/AUTHORING.md) packaged so an agent loads it on
its own. For Claude Code, either place is fine:

```bash
mkdir -p ~/.claude/skills/repanel                     # you, everywhere
cp skills/repanel/SKILL.md ~/.claude/skills/repanel/

mkdir -p .claude/skills/repanel                       # or the repository, for everyone on it
cp skills/repanel/SKILL.md .claude/skills/repanel/
```

It is optional. An agent with the MCP tools and no skill can still author,
submit and repair; the skill makes it go right the first time more often.

### Checking the work without an admin

```bash
pnpm --filter crewbase exec repanel validate
```

Assembles `repanel/` and checks it against the definition schema — the same
check a submission makes. Every problem is reported in the file that holds it,
with the path inside that file, what was expected, and a suggested fix.

---

## 4 · The admin, hosted

The first two steps needed nothing of RePanel's. This one needs the control
plane up. From the repository root, in separate terminals:

```bash
cp apps/api/.env.example apps/api/.env
printf 'APP_ENCRYPTION_KEY=%s\n' "$(openssl rand -base64 32)" >> apps/api/.env
docker compose up -d                    # RePanel's own postgres, on 5432
pnpm --filter @repanel/api db:migrate

pnpm dev:api        # 3001
pnpm dev:web        # 5173 — the console
pnpm dev:runtime    # 5174 — the admin
```

`APP_ENCRYPTION_KEY` encrypts customer connection strings at rest. **Keep the
one you generate.** Replacing it makes every stored connection and action secret
unreadable, and the console answers 500 for those projects until they are saved
again.

Then, in the console at `localhost:5173`:

1. **Sign up**, and **create a project** — call it Crewbase.
2. **Connection** → paste Crewbase's connection string:
   `postgres://crewbase:crewbase@localhost:5433/crewbase`. It is stored
   encrypted and never shown again. *Test connection* asks the database itself.
3. **Agent access** → *Mint token*. Copy the setup command it shows you:

   ```bash
   claude mcp add --transport http repanel http://localhost:3001/mcp \
     --header "Authorization: Bearer rpk_…"
   ```

   That gives your agent five tools scoped to this one project: read the schema
   documentation, read the current definition, submit a new one, read the
   verdict, read the project. None of them reads a customer record and none of
   them can see a connection string.
4. **Ask the agent to publish**:

   ```text
   Submit the definition in repanel/ to my RePanel project and repair
   anything it reports until it is valid.
   ```

   Or do it from the command line instead, over a session you authorize in your
   own browser:

   ```bash
   pnpm --filter crewbase exec repanel link      # sign in, pick the project, point it at your database
   pnpm --filter crewbase exec repanel deploy    # submit, and get back the admin's address
   ```

5. **Agent access** → copy the **action secret** into
   `examples/crewbase/.env` as `REPANEL_ACTION_SECRET`, and restart
   `pnpm --filter crewbase dev`. Without it, `approve` comes back as a refusal —
   which is the signature verification working.

Open the address the console shows you. Operators you add under **People** reach
that admin and nothing else — not the console, not the connection, not the
tokens.

---

## 5 · The admin, hosted, without handing over a connection string

The rung above assumes you are willing to give RePanel a credential to your
database. The connector is the answer when you are not.

You run one open-source binary beside your database. It holds the connection
string locally and **dials out** to RePanel, which sends it definition-derived
descriptors — which resource, which record, which action — and never SQL. The
same engine that runs in RePanel Cloud runs in that process, so the admin is
identical; what changes is who holds the credential.

In the console, on your project:

1. **Connection** → *Mint a connector token*. Copy the command it shows you. The
   token is displayed once and stored only as a digest.
2. Run it where the database is reachable:

   ```bash
   pnpm --filter crewbase exec repanel connect --token rpc_…
   ```

   From a published install that same line is `npx @repanel/cli connect --token rpc_…`,
   which is what the console prints.

   ```console
     RePanel     ws://localhost:3001/connector
     Database    localhost:5433/crewbase (from DATABASE_URL in .env)
                 postgres://crewbase:****@localhost:5433/crewbase

     ✓  The connection string above stays on this machine. RePanel sends
        this connector what to read, never how to read it, and it is served
        by the same engine the hosted runtime uses.

     ✓  Connected, serving definition version 1.
   ```

3. Open the admin. Reads, relations, pickers, forms and actions all work exactly
   as they did on the rung above.

Worth knowing:

- **It reads `DATABASE_URL` the same way `repanel dev` does** — your environment,
  `.env.local`, or `.env` — or `--database-url postgres://…`. A token can also
  be given as `REPANEL_CONNECTOR_TOKEN`, which is the better habit: a token on a
  command line is a token in your shell history.
- **It writes nothing to disk.** The definition and the action signing secret
  arrive over the authenticated channel and live in memory. Stopping it leaves
  nothing behind.
- **`httpCall` actions leave from the connector**, not from RePanel — so
  `approve` reaches `localhost:3002` even though RePanel cannot. The signing
  secret is delivered over the channel when the session opens, so no copying is
  needed on this rung.
- **Publishing reaches it.** Deploy a new definition and the connector says
  `Definition version 2 published; now serving it`.
- **Stopping it is safe.** The admin answers a plain "connector offline" until it
  is back; restart it and everything recovers with nothing else to do.
- **Minting a new token revokes the old one** and disconnects whatever was using
  it. Saving a connection string instead moves the project back to the rung
  above and takes the connector's token with it.

The Connection page shows *Connected* or *Offline* with a last-seen time, read
from the connector's own heartbeat.

---

## 6 · Working on Crewbase itself

```bash
pnpm --filter crewbase dev          # watch mode on 3002
pnpm --filter crewbase test         # the admin API's signature and rules
pnpm --filter crewbase typecheck
pnpm --filter crewbase build
```

**Changing the schema.** Edit the table under `src/db/`, then:

```bash
pnpm --filter crewbase db:push      # push the schema, no migration files
pnpm --filter crewbase seed         # re-seed; it truncates first
```

Then re-run the agent on the changed table, or hand-edit `repanel/`. With
`repanel dev` open, the admin reloads on save.

**Starting clean.**

```bash
docker compose -f examples/crewbase/docker-compose.yml down -v
docker compose -f examples/crewbase/docker-compose.yml up -d
pnpm --filter crewbase db:push && pnpm --filter crewbase seed
```

---

## The data

| Table | What it is |
|---|---|
| `users` | Crewbase's own staff, the people who run placements. |
| `airlines` | The hiring side. Approving one is a business decision, not a field edit. |
| `candidates` | Pilots, crew, engineers and dispatchers. **The hostile resource.** |
| `job_openings` | Seats an approved airline is hiring for. |
| `applications` | One candidate against one opening. |

## The admin API

One module, mounted at `/repanel`, behind one verification middleware
(`src/repanel/`). It holds a single route:

```
POST /repanel/airlines/:id/approve
```

It approves an airline **only if it is still pending** — anything else answers
409, and an airline that does not exist answers 404. The rule lives in
`src/airlines/airlines.service.ts`, because that is where it belongs: an admin
that flipped `approval_status` directly could approve an airline that had
already been rejected.

Every request to `/repanel/*` must carry a valid RePanel signature or it is
refused with 401 before it reaches a controller. The scheme is
[`docs/SIGNING.md`](../../docs/SIGNING.md) and the implementation is
`src/repanel/repanel-signature.ts` — an HMAC over `<timestamp>.<METHOD> <URL>`,
compared in constant time, with a five-minute tolerance so a captured request
stops working. `REPANEL_ACTION_SECRET` is whichever secret the caller signs with:
under `repanel dev` it is the one that run printed, under a hosted project it is
the project's action secret from the console (Project → Agent access), and under
a connector it arrives over the channel and needs no copying. Either way, if it
does not match, `approve` comes back as a refusal rather than as a success —
which is the verification working.

`pnpm --filter crewbase test` covers exactly that endpoint: signed and pending →
approved, signed and not pending → 409, unknown airline → 404, wrong secret →
401, no signature → 401, expired timestamp → 401.

## The traps (for humans reading this)

The point of Crewbase is that a naive admin over these tables would be wrong in
ways that matter. Each of these is something an authoring agent has to classify
correctly, and `docs/AUTHORING.md` is what tells it how.

1. **`users.password_hash`** — a credential sitting in the most ordinary-looking
   table in the schema. It must be marked `sensitive`, which keeps it out of
   columns, search, filters, sorting and action URLs. A hash is not "safe
   because it is hashed": it is an offline cracking target and it must never
   leave the API.

2. **`candidates.status`** — an enum with a workflow behind it. The trap is
   treating it as a field to edit. There is no endpoint for it in Crewbase
   because there is no rule to enforce, which makes a `dbUpdate` action the
   honest answer here — unlike `airlines.approval_status`.

3. **`candidates.deleted_at`** — a soft delete. Rows with it set are gone as far
   as the product is concerned, but they are still in the table, so an admin
   that lists them is showing deleted people to an operator. Mark it `hidden`.
   RePanel v0 cannot filter them out by default; the guide says so plainly
   rather than pretending otherwise.

4. **`candidates.profile`** and **`airlines.verification`** — JSONB written by
   and for internal code. The shape is unstable and the contents are working
   notes, so they belong on the detail page at most, never in a table column.

5. **`airlines.approval_status`** — the one with a rule. Only a pending airline
   may be approved, and the rule is in this repository, not in the definition.
   The definition's job is to point an action at `POST
   /repanel/airlines/{id}/approve` and let the application answer.

## Layout

```
src/
  airlines/    the approval rule, and the only writes Crewbase performs
  config/      zod-validated environment, read through one typed service
  db/          drizzle schema, one file per table
  repanel/     the admin API: signature middleware + the routes RePanel may call
  seed/        ~200 deterministic rows
repanel/       the admin definition: app.json + one file per resource
```

## Where to go next

- [`docs/AUTHORING.md`](../../docs/AUTHORING.md) — how a definition is decided,
  written for the agent writing one.
- [`docs/THREAT-MODEL.md`](../../docs/THREAT-MODEL.md) — what each rung above
  actually trusts RePanel with, stated with the mechanism that enforces it.
- [`docs/SIGNING.md`](../../docs/SIGNING.md) — the signature scheme, with a
  verification snippet that is executed by a test.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — standing RePanel itself up, and
  the suites that need a real database.
