# RePanel threat model

RePanel renders an admin interface over a customer's production database, from
a definition their coding agent wrote. Every security question worth asking
about this product is inside that sentence: an agent authors the thing, RePanel
executes it, and what it executes reaches real data.

This page says what RePanel holds, what each part of it can and cannot do, and
— in [§8](#8-residual-risk) — what is still *trusted* rather than *enforced*.

**Every claim below names what enforces it**: a numbered entry in
[`DECISIONS.md`](DECISIONS.md), or the module the rule is a property of. A
sentence with nothing after it would be a promise, and a promise is not a
control. If a claim here is false, that is a vulnerability report and we would
rather have it — [`SECURITY.md`](../SECURITY.md) says how to send one.

RePanel is pre-1.0 and in public preview. Where something is planned rather
than built, this page says so and names the task.

## 1. The system

```
  the customer's repo & laptop        RePanel Cloud        the customer's
  ────────────────────────────        ─────────────        production estate
                                                           ─────────────────
  coding agent ─── MCP · rpk_ ───▶ ┌───────────────┐
    writes definition files        │ apps/api      │─ pooled DSN ─▶ Postgres
                                   │   definition  │
  repanel link · deploy ─ session ▶│   validation  │─ signed ─────▶ the app's
                                   │   control     │  httpCall      /repanel/*
  the operator's browser ─ session▶│   plane       │
    apps/web · apps/runtime        │   + engine    │
                                   └───────────────┘

  repanel dev ── packages/engine ──▶ a local database
    loopback only; reaches nothing off the machine (#048)
```

**`apps/api`** is the control plane and the only process that holds anything
dangerous: accounts, projects, definitions, the encrypted DSN, the per-project
action secret. It embeds `packages/engine` through thin injectable adapters.

**`packages/engine`** is the safety core: the query builder, the customer
connection pool, record mapping, read and action execution. It is given a
validated definition, a way to reach a database and a secret to sign with, and
it looks nothing up for itself — no environment, no secret store, no database
of its own.

**`apps/runtime`** is the generated admin: a React app that reads
`/runtime/:projectKey/*` and renders what comes back. **`apps/web`** is
RePanel's own console — sign-in, projects, the connection form, agent tokens.
Two origins by design (#025), which is why each is a named, validated
environment variable (#040).

**`packages/cli`** is `repanel`: `validate` and `dev` run entirely on the
developer's machine; `link` and `deploy` reach Cloud over a session a human
authorized in their own browser (#049).

**The coding agent** is present at authoring time and nowhere else. It speaks
MCP to `apps/api` and holds an `rpk_` token scoped to one project.

## 2. Trust boundaries

There are five, and each is a place where something is checked rather than
assumed.

**2.1 · Browser → API.** Every controller a browser reaches is behind
`SessionAuthGuard` (`apps/api/src/auth/session-auth.guard.ts`) — projects,
connections, definitions, agent tokens, actions and the runtime — with the two
routes that *create* a session and the health check as the only exceptions. A
runtime route then asks whether this user owns this project
(`RuntimeService.readContext` → `ProjectsService.requireOwnedByKey`,
`apps/api/src/runtime/runtime.service.ts`). Someone else's project answers
`404`, not `403`, because the existence of a project is itself an answer
(`apps/api/src/projects/projects.service.ts`). CORS is derived from
`CONSOLE_URL` and `RUNTIME_URL` rather than declared, so it cannot drift from
where those surfaces are actually deployed (#040).

**2.2 · Agent → API.** `AgentTokenGuard` establishes *who* and stops there;
every MCP tool then asks a service what that agent may reach
(`apps/api/src/agent-tokens/agent-token.guard.ts`). A token names exactly one
project, so every other project reads as missing to it —
`ProjectsService.requireAccess`. The surface is five tools and no more:
`get_project`, `get_schema_documentation`, `get_definition`,
`submit_definition`, `get_validation_result` (`apps/api/src/mcp/mcp-tools.ts`,
public contract per #020). **None of them reads a customer record, and none of
them touches a connection string.**

**2.3 · API → the customer's database.** The DSN is decrypted only to open a
pool, on demand, and is held nowhere
(`apps/api/src/connections/customer-pool.service.ts`). Every statement that
crosses this boundary was written by `QueryBuilder` from a validated
definition (#024, `packages/engine/src/query/query-builder.ts`). This is the
boundary [§8.1](#81-direct-dsn-you-are-trusting-repanel-cloud-with-a-credential)
is about.

**2.4 · API → the customer's application.** One signed HTTP request per
`httpCall` action, to an absolute URL the definition wrote down (#013,
`packages/engine/src/actions/http-call.ts`). Nothing that comes back is read.

**2.5 · The developer's machine.** `repanel dev` binds `127.0.0.1`
(`packages/cli/src/commands/dev.ts`) and reaches nothing off the machine except
the database the operator confirmed and the endpoints their own definition
declares (#048). That is checked two ways — see [§7](#7-what-we-ask-you-to-run-and-verify).

## 3. Assets

| Asset | Where it lives | Who can read it | What keeps it there |
|---|---|---|---|
| Customer DSN | `connections.encrypted_dsn`, AES-256-GCM, format `v1.<iv>.<tag>.<ct>` | the API process holding `APP_ENCRYPTION_KEY` | `apps/api/src/crypto/crypto.service.ts`; #023 |
| — on the wire | it never leaves: responses carry `kind`, `host`, `database` and nothing else | — | `connections.mapper.ts`, built from a DSN passed in *to be taken apart*; asserted by `connections.service.spec.ts` ("never answers with the connection string, whatever it is asked") |
| Action secret | one per project, 32 random bytes base64url, stored encrypted | the signed-in owner, once, via `GET /projects/:id/action-secret` | `projects/action-secret.ts`; `ProjectsService.revealActionSecret` → `requireOwned` |
| Agent token | `rpk_` + 40 base62 (~238 bits), stored as a sha256 digest | the agent it was handed to | `agent-tokens/agent-token.ts` — a leaked table cannot be replayed |
| Operator session | 256-bit token, stored as a sha256 digest; `httpOnly`, `SameSite=Lax`, `Secure` in production; fixed 30 days, no sliding | the browser holding the cookie | `auth/session-token.ts`, `auth/session-cookie.ts`, `auth/auth.service.ts` |
| Operator password | bcrypt, cost 12 | nobody | `auth/password.service.ts` |
| `APP_ENCRYPTION_KEY` | the deployment's environment | the API process | validated at boot as 32 base64 bytes; the process refuses to start without one outside tests (`config/env.schema.ts`) |
| The definition | `definitions` holds the draft and `definition_versions` a verbatim copy of each version published from it, both plaintext (it is the customer's own document). A published version is never rewritten and never deleted; deleting the project takes them with it | the project's owner and its agent token | ≤ 1 MiB before anything parses it (`definitions/definition-size.ts`); re-validated on every read, published or drafted (#047, `runtime.service.ts`) |
| Customer records | the customer's database, and nowhere else | the project's owner, through the admin | RePanel stores no records and caches none — there is no cache and no Redis in either package ([§7](#7-what-we-ask-you-to-run-and-verify) has the grep). Every read runs against the customer's database and is mapped straight to a DTO (`engine/src/read/record-reader.ts`, `read/records.mapper.ts`) |

Two things are absent from that table because they do not exist. RePanel holds
no copy of the customer's data, and `packages/engine` writes no log line at all
(`grep -rn "console\.\|Logger" packages/engine/src` is empty), so there is no
query log to leak. The one place a customer's database is named in a log is a
dead pooled connection, which names the project and not what it connects to
(`connections/customer-pool.service.ts`).

## 4. What each component can and cannot do

**`packages/engine`** *can* read and write the customer's database. It *cannot*
choose what to read: it executes only definition-derived queries, and a query
shape the definition cannot express does not run (#024). It cannot find a
database on its own — `CustomerPool` is handed a `resolveDsn` function and
looks nothing up (`pool/customer-pool.ts`). It cannot decide who may ask; a
caller has been authorized long before it gets there.

**`apps/api`** *can* do everything above plus decrypt DSNs and mint secrets. It
*cannot* return a DSN to any caller ([§3](#3-assets)), and it cannot leak
internals into a response: one exception filter maps domain errors to HTTP and
answers everything else with `internal_error`, logging the stack rather than
sending it (`errors/domain-exception.filter.ts`).

**`apps/runtime`** *can* render whatever the API answers. It *cannot* choose a
query: the address of every request is built from the definition's own resource
and field keys, and the API re-derives everything from the definition anyway.
It cannot execute customer data — see [§5.2](#52-untrusted-content).

**The coding agent** *can* read the schema documentation, read the current
definition, submit a new one, and read the verdict. It *cannot* read a customer
record (there is no such tool), *cannot* see or set a connection string (#023),
and *cannot* reach a second project (`requireAccess`). Its submissions are data
that must pass validation before anything executes them.

**The customer's application** *can* refuse or perform an action. It *cannot*
put anything into an operator's browser: the response body of an `httpCall` is
cancelled unread (`engine/src/actions/http-call.ts`).

**`repanel dev`** *can* read the local database the operator confirmed. It
*cannot* reach RePanel, an analytics endpoint, or anything else off the machine
(#048; [§7](#7-what-we-ask-you-to-run-and-verify)).

## 5. The lethal trifecta

The framing is Simon Willison's: an agentic system is dangerous when it can
reach **private data**, ingest **untrusted content**, and **communicate
externally**. A security engineer will map RePanel onto it within five minutes
of arriving, so here is our own map.

### 5.1 Private data

The customer's database is as private as data gets, and RePanel reads it on
every page. What bounds the reading is that **nothing chooses a query except a
validated definition** (#024).

- **Identifiers come only from the definition.** `quoteIdentifier` is the one
  place a table or column name is written into SQL, it refuses anything that is
  not a definition identifier, and it quotes whether or not the value looks
  dangerous (`engine/src/query/identifier.ts`). A request never contributes an
  identifier — it contributes a key, which is looked up, and what gets written
  is the definition's own copy (`query/query-builder.ts`).
- **Caller values enter only as bound parameters.** `Parameters` has no method
  that returns SQL, so there is no way to write a value into a statement
  instead of binding it (`engine/src/query/parameters.ts`). Search terms have
  `%`, `_` and the escape character neutralised before binding
  (`query/conditions.ts`).
- **Sensitive containment is total, and it is enforced twice.** A field marked
  `sensitive` may not appear in table columns, search, filters, the default
  sort, a primary key, a label field, a relationship's foreign key, a
  `visibleWhen` condition, a `dbUpdate` target, or an `httpCall` URL template
  (#014, extended by #027; `contracts/src/definition/table-view-checks.ts`,
  `resource-checks.ts`, `action-checks.ts`, `visibility-checks.ts`). Filters
  and sorting are in that list because they are an *oracle*: they answer
  questions about a value without rendering it. The engine then refuses the
  same things again at the statement, for definitions stored before a rule
  existed — `selectFields` drops sensitive fields and there is no other door
  (`engine/src/query/columns.ts`), and `lookup`, `update` and owner-narrowing
  each refuse a sensitive field outright (`query/query-builder.ts`).
- **`hidden` is not a second security flag.** It is a display choice; `sensitive`
  is the security one, and blurring them would make both useless (#014).
- **Every query is bounded.** A 5-second statement timeout on every pooled
  session, at most 5 clients per customer database
  (`engine/src/pool/customer-pool.ts`), a page size of at most 100
  (`contracts/src/runtime/requests.ts`), and a total order on every list so
  paging cannot show one record twice (`query-builder.ts`).

### 5.2 Untrusted content

The admin renders values written by the customer's own users — names, notes, a
`url` column somebody chose. That content is untrusted. It never becomes
instructions to our system, for a structural reason and three mechanical ones.

**The structural reason: there is no interpreter in the serving path.** RePanel's
runtime contains no model. The agent is present when a definition is *authored*
and absent when it is *executed*; between the two sits validation. The only
things that consume a customer record at runtime are React rendering text and a
Postgres driver holding bound parameters, and neither takes instructions.

- **Values are rendered as text, never as markup.** There is no
  `dangerouslySetInnerHTML` and no `innerHTML` anywhere in `apps/runtime`,
  `apps/web` or `packages/ui` — one grep says so, and it is in
  [§7](#7-what-we-ask-you-to-run-and-verify). The runtime's dependency list is
  six packages, with no markdown or HTML renderer among them
  (`apps/runtime/package.json`).
- **A value that looks like an address is checked before it becomes one.** A
  `url` column holds `javascript:` as easily as `https:`, so `SafeLink` admits
  only `http:`, `https:` and `mailto:`, renders anything else as the text it is,
  and sends external links with `rel="noopener noreferrer"`
  (`apps/runtime/src/features/runtime/detail-value.tsx`).
- **A record value can never re-point a request.** An `httpCall` URL is resolved
  from values the API read for itself, never from anything the browser sent, and
  each value is percent-encoded — so a reference carrying a `/` or a `?` cannot
  address a route the definition did not name. A placeholder that resolves to
  nothing is refused rather than left as a hole
  (`engine/src/actions/action-url.ts`).
- **The definition itself is data, not code.** It never contains branching,
  sequencing or computation (#010); the schema is closed vocabularies and strict
  objects (`contracts/src/definition/`); an action is one of two kinds; an icon
  is one of thirty names (#031). There is no expression language to escape from.

The one component that *does* read prose is the authoring agent, and what it
reads is ours — schema documentation and validation errors, generated from the
definition it just submitted. It has no tool that returns a customer record, so
the classic path (agent reads private data, agent is talked into sending it
somewhere) has no first step. Prompt injection against the agent through the
customer's own repository is real and is [§8.5](#85-the-authoring-agents-inputs-are-the-customers-repository).

### 5.3 External communication

**`httpCall` is the only egress**, and that is checkable rather than asserted:
across `packages/engine/src` and `apps/api/src` there is exactly one `fetch`,
in `actions/http-call.ts`.

What bounds it:

- **The address is the definition's.** An `httpCall` URL is an absolute
  `http(s)` URL in the schema (`contracts/src/definition/actions.ts`), with
  `{field_key}` placeholders that must name real, non-sensitive fields —
  refused at validation (`action-checks.ts`) and refused again at resolution
  (`engine/src/actions/action-url.ts`).
- **Every request is signed.** HMAC-SHA256 over `<timestamp>.<METHOD> <URL>`
  under the project's secret, sent as `Repanel-Timestamp` and
  `Repanel-Signature: v1=…` (#013, `engine/src/actions/action-signature.ts`).
  The timestamp is inside the payload as well as beside it, which is what makes
  refusing an old one worth anything. The whole scheme is
  [`SIGNING.md`](SIGNING.md).
- **Redirects are not followed.** The signature covers the address the
  definition named, so a hop would arrive somewhere else carrying proof for
  somewhere else; a 3xx is read as the application declining
  (`http-call.ts`, `redirect: "manual"`).
- **Nothing comes back.** The response body is cancelled unread; the operator
  is told which of four things happened and never what the application said
  (`http-call.ts`).
- **Ten seconds, then it is a timeout** (`CALL_TIMEOUT_MS`, `http-call.ts`).
- **Sensitive fields are banned from URL templates** because a URL reaches
  access logs, proxies and error trackers — which is exactly the hint the
  validator gives (#014, `action-checks.ts`).

### 5.4 Why the three do not compose

The trifecta is dangerous when one actor holds all three legs. In RePanel they
are held by different components, at different times:

| | private data | untrusted content | external communication |
|---|---|---|---|
| coding agent | no tool reads records | reads its own repo and our schema docs | MCP to RePanel only |
| `apps/api` + engine | yes | consumes it as bound parameters | one `fetch`, to an address the definition named, signed |
| `apps/runtime` | renders what it is served | renders it as text | its own API only |

The agent, which is the component that can be argued with, is the one that
cannot read the data or call out. The component that can read the data and call
out is the one that takes no instructions — it executes a definition that
passed validation, and validation happened before the data was ever touched.

## 6. Secrets never transit the agent

This is a design rule, not a coincidence, and it is #023: **a connection string
enters once, from a human acting in their own session, and never leaves — and
it never passes through an authoring agent in either direction.** #049 extended
the same rule to the CLI: the DSN passes through no agent, no log, no file and
no argument.

The rule creates a problem — a human has to supply the DSN somehow — and it is
answered with side channels rather than exceptions:

- **The console.** When a project has no connection, `get_project` answers
  `hasConnection: false` and a `connectionSetupUrl`, and the tool's own
  description tells the agent to send the human there: *"Never ask for a
  connection string and never handle one"* (`apps/api/src/mcp/mcp-tools.ts`).
  The human pastes the DSN into the console, which is behind their own session.
- **The CLI, for Cloud.** `repanel link` reads the DSN from the environment the
  application already uses and sends it over a session the human authorized in
  their own browser — environment → CLI → API. `link` deliberately takes no
  `--database-url`: the flag `dev` has is a local convenience and would be a
  shell-history leak here (#049, `packages/cli/src/commands/link.ts`).
- **The CLI, for local work.** `repanel dev` finds the DSN the way a developer
  would look — the flag, then the shell, then `.env.local`, then `.env` — reads
  those files without loading them into `process.env`, and asks the operator to
  confirm what it found (`packages/cli/src/database-url.ts`).
- **The action secret.** Read once from the signed-in owner's session
  (`GET /projects/:id/action-secret`), or, under `repanel dev`, generated per
  run and printed once with nothing written to disk (#048).

The same rule is why `apps/api` answers `{kind, host, database}` for a
connection and why the four probe outcomes are a closed set — `unreachable`,
`auth_failed`, `timeout`, `unknown` — rendered per category, never as driver
text (#023, `connections/connection-probe.service.ts`).

## 7. What we ask you to run and verify

Not one of the claims above needs to be taken on trust.

**Verify the signature scheme against your own application.**
[`SIGNING.md`](SIGNING.md) is the whole scheme, and the verification snippet in
it is *executed* by `packages/engine/src/actions/signing-doc.spec.ts` against a
request the real signer produced — so the document cannot drift from what
RePanel sends. Copy it, wire it in front of your `/repanel/*` module, and
confirm that an unsigned request is refused and a replay past five minutes is
refused.

**Re-run our greps.** Each of these is a claim on this page:

```sh
# §5.3 — one outbound call in the whole serving path
grep -rn "fetch(\|node:http\|axios\|undici" packages/engine/src apps/api/src \
  | grep -v "\.spec\.\|\.test\."

# §5.2 — no HTML injection surface anywhere in the UI
grep -rn "dangerouslySetInnerHTML\|innerHTML" apps/runtime/src apps/web/src packages/ui/src

# §3 — the engine logs nothing and caches nothing
grep -rn "console\.\|Logger" packages/engine/src | grep -v "\.spec\.\|\.test\."
grep -rni "cache\|redis" packages/engine/src apps/api/src | grep -v "\.spec\.\|\.test\."

# #040 — no absolute URL for one of our own surfaces outside the config modules
grep -rnE "https?://(localhost|127\.0\.0\.1)" --include='*.ts' --include='*.tsx' apps \
  | grep -vE "src/config/env\.ts:|src/config/env\.schema\.ts:|vite\.config\.ts:|\.spec\.tsx?:|\.test\.ts:"
```

That last one is scoped to `apps` because the CLI keeps the same rule in its
own module: `REPANEL_API_URL` and `REPANEL_CONSOLE_URL`, defaulting to the
development deployment, read in `packages/cli/src/cloud/addresses.ts` and
nowhere else (#049). A URL that lives in exactly one validated place is
configured; a URL compiled into a component is not (#040).

**Run the suite** — `pnpm -r test` from the repo root. Two specs are the
egress guarantee of `repanel dev` and are worth reading rather than only
running: `packages/cli/src/dev/no-egress.test.ts` follows the command's module
graph from `dev.ts` and asserts both what must be inside the closure and what
must be outside it, and `packages/cli/src/dev/dev-server.test.ts` exercises the
whole request cycle with every non-loopback socket refused at
`net.Socket.prototype.connect`. The gate was rewritten once because its first
version could not fail (#048), which is the reason both exist.

**Operate the database role, because that part is yours.** RePanel reads what
the definition names; your database decides what the role can reach. Under
direct DSN this is the strongest control you hold and RePanel does not enforce
it: give it a role scoped to the tables your definition names, read-only unless
your definition has `dbUpdate` actions, in which case `UPDATE` on those columns
and nothing more. Restricting inbound access to RePanel's egress addresses is
the second one.

## 8. Residual risk

### 8.1 Direct DSN: you are trusting RePanel Cloud with a credential

**Say it plainly: in hosted RePanel today, we hold a connection string to your
database.** It is encrypted at rest with a key that lives in the deployment's
environment rather than in the database (#023,
`apps/api/src/crypto/crypto.service.ts`, `config/env.schema.ts`), which defends
a stolen table dump and *not* a compromised API process. Whoever controls that
process can decrypt what the process can decrypt, and can then run whatever
your database role permits. No amount of query-builder discipline changes that
— #024 bounds what RePanel's own code will ask for, not what an attacker
holding the process could ask for.

What reduces it today: the least-privilege role and network restrictions in
[§7](#7-what-we-ask-you-to-run-and-verify); a credential you can rotate at any
time through the console, which releases the open pool the moment it is
replaced (`ConnectionsService.set` → `pools.release`); and self-hosting outright,
which the AGPL licence exists to make possible
([`LICENSING.md`](LICENSING.md)).

**The structural answer is the connector, and it is not built yet.** Task
[031](tasks/031-connector.md) is one open-source binary that runs beside your
database, holds the DSN locally and dials *out* to Cloud; Cloud sends
definition-derived descriptors over the existing runtime request contract and
never SQL — #024 extended across the network, with a grep gate asserting that
no SQL string crosses the wire. When it ships, the trust assumption in this
section becomes "RePanel can ask for what your definition allows" instead of
"RePanel holds a credential to your database", and direct DSN remains the
default onboarding path rather than being replaced. Until then, this section is
the honest state of things.

### 8.2 Every operator is the project owner

There is one account per project. `requireOwned` and `requireOwnedByKey` are
the whole of the authorization model (`apps/api/src/projects/projects.service.ts`),
so there is no operator who can use the admin without being able to use the
console, and no separation between the person who configures RePanel and the
person who runs actions. Roles are task [029](tasks/029-operator-roles.md).

### 8.3 There is no audit log

An action is executed and its outcome is reported to the operator who ran it;
nothing durable records who did what. That is task
[028](tasks/028-audit-log.md), which will capture before/after values and never
capture sensitive fields.

### 8.4 A definition is trusted after validation, not while it runs

Validation is the choke point, and the engine re-refuses containment violations
at the statement as defence in depth (#027, `engine/src/query/query-builder.ts`).
The honest statement is still that **whoever can submit a definition chooses
what the admin reads** — within the schema's limits, which is a read of the
tables and columns they name. Today that is the project's owner and its agent
token, and an agent token reaches exactly one project. Treat an `rpk_` token
with the care you would give a read credential.

### 8.5 The authoring agent's inputs are the customer's repository

An agent writes a definition by reading a codebase, and a codebase can contain
text that argues with it. RePanel does not defend against prompt injection
against your agent; nothing in this repository can. What it does is bound the
blast radius: the agent has no tool that reads a customer record, no tool that
touches a connection string (#023), and no reach beyond one project — so an
agent that has been talked into something writes *a definition*, and a
definition is validated before anything executes it. The worst case is a
definition that surfaces tables you did not intend to surface, which is visible
in the admin, visible in `repanel validate`, and reversible by submitting
another one.

### 8.6 A compromised customer application can lie about an action

Success is the application's 2xx to give. RePanel reports what it was told and
nothing else, and the response body never reaches an operator's browser
(`engine/src/actions/http-call.ts`) — but an endpoint that answers `200`
without doing the work is indistinguishable from one that did.

### 8.7 The action secret does not rotate in v0

One secret per project, minted once. #013 records how rotation will work — two
secrets accepted at once, so a rollout never has a moment where one side is
ahead of the other — and [`SIGNING.md`](SIGNING.md) says so to the customer.
Until then, rotating means re-reading the secret and restarting the
application.

### 8.8 `repanel dev` has no accounts

It is a development server on `127.0.0.1` with one synthetic local operator, so
anything on the machine that can reach the port is an operator
(`packages/cli/src/dev/api-routes.ts`, #048). Its action secret is generated
per run, printed once and written nowhere, which is deliberate: a development
secret that persists is one that eventually ships.

### 8.9 The bounds are bounds, not a denial-of-service defence

A 5-second statement timeout, 5 pooled clients, 100 records a page, a 1 MiB
definition and a 10-second action timeout bound a single request. They do not
stop an authenticated operator from being expensive, and SECURITY.md puts
volumetric denial of service out of scope for that reason.

### 8.10 Deployment hardening is the deployment's

RePanel ships no CSP, no HSTS and no TLS configuration; a self-hosted install
is yours to operate, and the hosted product's headers are a property of the
deployment rather than of this repository.

## 9. What this document does not claim

It does not claim RePanel has been formally verified, professionally audited,
or run in anger at scale — it is pre-1.0 and says so. It does not claim the
list in [§8](#8-residual-risk) is exhaustive; it is what we know, written down
so that a reader can argue with it and so that the next entry has somewhere to
go. And it does not describe `examples/crewbase`, which is a deliberately
trap-laden reference application whose exposed password hash is *the point* of
it (see its `README.md`, and SECURITY.md's out-of-scope list).

Found something this page gets wrong? That is a finding.
[`SECURITY.md`](../SECURITY.md) has the private channel — a wrong claim in a
threat model is itself a defect worth reporting.
