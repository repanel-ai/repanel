# Decision Log

Append-only. Format: number, date, decision, why. Reversing a decision is a new
entry, never an edit.

001 · 2026-08 · pnpm monorepo: apps/api (NestJS), apps/web (React+Vite),
packages/contracts. Contracts is the only shared package; DB schemas stay in
the API. Why: one source of truth for the wire contract; no package sprawl.

002 · 2026-08 · zod everywhere (env, request DTOs, definition schema). No
decorator-based validation. Why: the definition schema must be validatable
outside RePanel (public contract, browser-safe, standalone validator later);
one validation idiom across the codebase.

003 · 2026-08 · Definition schema is milestone zero, designed before the MCP
server or renderer. Why: it is the public product contract; everything else
consumes it.

004 · 2026-08 · Postgres only through POC and MVP. No MySQL. Why: make one
ecosystem exceptional; a second DB is pure scope cost before first customers.

005 · 2026-08 · Renderer quality before control-plane polish. Why: the demo
that sells the product is the generated admin, not the dashboard.

006 · 2026-08 · One HTTP action in the POC (not deferred to MVP). Why:
"the application owns business logic" must be proven mechanically, early.

007 · 2026-08 · Create/edit forms deferred; POC/early MVP is world-class
read + actions, forms later behind per-resource opt-in. Why: safety risk and
complexity concentrate in writes; read-only-by-default buys trust.

008 · 2026-08 · MCP validation errors must carry: exact location, expectation,
suggested fix. Why: error quality determines agent success rate; it is the
cheapest highest-leverage feature in the loop.

009 · 2026-08 · Work is executed as bounded task files (docs/tasks/) run by a
coding agent; CLAUDE.md is the standing rulebook. Out-of-scope lists are binding.

010 · 2026-08 · Complexity policy: the definition schema never contains
branching, sequencing, or computation. Multi-step / conditional operations
are customer application endpoints invoked via httpCall actions; the agent
authors both sides. Schema grows only by declarative additions (action
inputs, fixed-vocabulary preconditions, relationship context), each gated
by "can the runtime render it excellently for everyone?" Why: keeps the
schema agent-generatable and the runtime ownable; the agent makes the
endpoint escape hatch nearly free, so the format never needs to become a
programming language.

011 · 2026-08 · Mission framing: bring a Filament-class admin experience to
every stack and language. The coding agent is the universal adapter — stack
support is authored as agent guidance (markdown), never as per-framework
SDKs. The definition stays strictly stack-neutral. Constrained patterns may
grow Filament-style (widgets, pages) in later phases; a blank canvas never.

012 · 2026-08 · Reversibility posture: the definition captures high-level
intent, which preserves every exit — runtime replacement, schema migration
(agent-assisted, near-free), and worst-case `repanel eject` generating an
owned codebase FROM the definition. The true one-way door is the
compatibility ratchet: once external definitions exist, schema changes are
additive or migrated, never breaking-in-place. Schema changes are reviewed
as public API changes. Genuinely custom pages, if ever needed, enter as an
additive "embedded customer view" nav entry — never as layout primitives
inside the definition.

013 · 2026-08 · Companion endpoints convention: customer-side logic invoked
by actions lives in ONE mounted admin-API module (default prefix /repanel/*),
behind one verification middleware, scaffolded by the agent from our
per-stack guide. Outbound requests are HMAC-signed (Stripe-webhook-style:
timestamp + body, per-project secret, rotation via dual secrets). Reads and
dbUpdate actions require zero app changes; endpoints appear only where
business logic exists. Rationale: matches the normalized webhook/Filament
precedent; puts operational logic in the customer's repo (tested, versioned,
reviewed) rather than in a vendor UI; the module doubles as the app's
operations API.

014 · 2026-08 · Sensitive-field containment is total: sensitive fields may
not appear in table columns, search, filters, or httpCall URL templates —
any surface where values render OR can be probed (filter/search = an
interactive oracle even when values never display). dbUpdate on hidden
fields stays legal: hidden is a display concern, sensitive is a security
one, and the two flags must not blur. Why: #008 — leaks die at validation;
and a crisp sensitive/hidden distinction keeps authoring agents from
misusing one as the other.

015 · 2026-08 · Hint policy: validation hints suggest only safe fixes.
A containment error (sensitive/hidden/etc.) never offers unsetting or
weakening the protective flag as a remedy — the bypass must not live in the
error message. Humans relax flags; hints don't. Why: authoring agents take
the shortest path a hint offers; the shortest path must be the safe one.

016 · 2026-08 · Repositories translate persistence error codes into domain
errors: a pg `23505` unique violation leaves the repository as `ConflictError`,
never as a raw ORM failure. This is not domain logic leaking downward — hiding
persistence detail behind a domain-meaningful signal is the repository's one
job, and an error code is exactly such a detail. Applies wherever a constraint
violation carries a domain meaning; first application is the duplicate-email
race in auth, where check-then-insert alone answers concurrent signups with a
500 instead of a 409. Why: the database is already the authority on what
"already exists" means, so a service-level pre-check must not be the only
guard; and #008's error-quality bar applies to every caller, not just MCP.

020 · 2026-08 · MCP surface v0 is public contract: five tools (get_project,
get_schema_documentation, get_definition, submit_definition,
get_validation_result), token-scoped with no project arguments, stateless
HTTP transport. Invalid definitions are successful verdicts (never isError);
refusals are isError; error lists are never truncated and carry a count the
agent can verify. The transport never pre-validates definitions — the
validator's repairable errors are the only errors an agent sees. Server
instructions teach the authoring loop. Why: tool names, shapes, and
descriptions are the product's onboarding for every customer's agent (#008).

021 · 2026-08 · Agent guidance ships in three layers: MCP descriptions +
server instructions (minimal, always-on, MUST be self-sufficient for a naive
agent), an installable skill packaging AUTHORING.md (deep workflow:
inspection, field classification, companion-endpoint scaffolding, monorepo
navigation — loaded on demand), and per-stack guides referenced by the skill
(#011, community-contributable). The skill improves activation but never
gates it; all three layers share one source tree, no drifting copies.
Skill packaging lands post-013; POC measures the skill-less floor first.

022 · 2026-08 · Checkpoint B (first naive-agent test): valid definition in
1 prompt / 1 submission / 0 repairs; server instructions sufficed without a
skill; agent independently derived the no-actions-without-admin-endpoints
rule (#010). Rulings from findings: always-quote makes Prisma-cased
identifiers fully supported (pin with a mixed-case test in 008; fix
SCHEMA.md wording); repo convention is repanel/definition.json at repo root
(server = execution truth, file = reviewable source; standardized in 013);
definition-vs-live-schema drift check backlogged post-POC.

023 · 2026-08 · Connection secrets containment: the DSN never crosses the
API boundary in either direction — stored AES-256-GCM (v1 format), responses
carry only kind/host/database, logs verified DSN-free. The four probe
failure categories (unreachable | auth_failed | timeout | unknown) are
public contract; the control plane renders per category and never renders
driver text. Why: the customer DSN is the most dangerous value we hold;
containment is structural, not reviewed-in.

024 · 2026-08 · Runtime query safety: the query engine executes only
definition-derived queries. Table/column identifiers come exclusively from a
validated definition (quoted, allowlisted); user input enters only as bound
parameters; sensitive fields are never selected; every query carries a
statement timeout and a hard row limit. A query shape the definition cannot
express does not run. Why: the customer DB connection is the most dangerous
thing we hold; safety by construction, not by review.

025 · 2026-08 · Web splits into two apps before any web code exists: apps/web
(console/control plane) and apps/runtime (the generated admin renderer), with
packages/ui as a second shared package (owned components + tokens, strictly
presentational). Amends #001's "contracts is the only shared package" by its
own criterion — a component system consumed by two frontends is absolutely
shared. Runtime imports only ui + contracts, enforced by structure. Each app
owns its own api-client (surfaces diverge; error shape from contracts). Dev
runs two origins (log in on each; accepted); production composition decided at
deployment. Supersedes the earlier one-app-two-surfaces framing (#001) —
reversed because the split is free before 009 runs and the runtime app is the
product (future snapshot versioning, custom domains, operator-only access).

026 · 2026-08 · Runtime UI is built from owned components (shadcn-style copy-in
over Radix + Tailwind in packages/ui), reversing the north star's HeroUI
choice; TanStack Table for grids. Depend on behavior (Radix a11y/focus/
keyboard), own presentation (every visual line in-repo). Presets/theme
generators are references, not designs — the runtime's default identity comes
from 010's design gate. Per-customer theming deferred post-MVP as a constrained
CSS-variable override set. Why: the runtime's look is the product (#005) and
its stability is a promise; neither sits downstream of a component library's
release schedule.

027 · 2026-08 · Two more sensitive-containment checks move into validation
before the compatibility ratchet closes (#012): a table's `defaultSort.field`
and a relationship's `foreignKey` may not be `sensitive`. Both were already
refused by the runtime — the sort silently dropped, the traversal answered with
`UnservableResourceError` — and both refusals stay as defense in depth for
definitions stored before the rule existed. Why: a silent degradation is the
one outcome #008 has no answer for. An ordering is probeable (paging reveals
the ranking a secret column imposes, without rendering a value) and a foreign
key is both selected and matched on, so #014 already covered them in spirit;
what was missing was the repairable error that tells the authoring agent so.
Hints name safe fixes only (#015). Narrowing validation is a breaking change
for a definition that relied on the gap, which is exactly why it lands now.

028 · 2026-08 · Design tokens are Tailwind 4 CSS-first: `packages/ui/src/tokens.css`
owns the single `@theme` block, and there is no `tailwind.config.js` and no JS
preset anywhere in the repo. Both apps import the file; a token is added by
naming a CSS variable there and nowhere else. Dark mode re-points the same names
under a `.dark` class (`@custom-variant`), never a media query, so an operator's
choice is not overridden by the OS and no component carries a `dark:` class.
Task 010's approved palette lands as values in that block — the structure is
already in place, the concept replaces what the names are worth. Why: Tailwind 4
made CSS the configuration surface, so a JS preset would be a second source of
truth for the same names; and #026 puts every visual line in the repo, which is
only true if the tokens are one file a human can read top to bottom.

029 · 2026-08 · Badge severity comes only from an explicit signal in the
definition: an additive optional `tones` map on enum fields (value ->
positive | neutral | attention | critical). It is never inferred from how a
value is spelled, and a value the map does not mention renders with the quiet
treatment — which is also what every value gets until the map exists.
Implementation lands with task 011. Why: the runtime has never seen the
customer's vocabulary, and guessing severity from spelling is guessing about
someone else's domain — `suspended` is routine in one product and an alarm in
the next, and `active` can be the alarm. 010's badge language deliberately
builds three treatments and spends one (DESIGN.md §4); the other two are
unreachable until the schema can name them. The map is additive by
construction — its absence is today's behaviour — so deferring it costs
nothing and inventing it early would fix a vocabulary before any customer has
one.

030 · 2026-08 · Dates render in one fixed shape on every surface: `14 Jul 2026`
in UTC, with the exact value on hover — never the reader's locale. A value that
arrives without a zone is read as the clock it was written on rather than
re-projected, because the API strips the zone from `date` and `timestamp`
columns on purpose (#024's mapper) so the customer's stored reading survives
the wire. A project-level display timezone is the future additive answer. Why:
a column whose dates change shape per reader cannot be scanned, and two
operators comparing the same table over a ticket have to mean the same row when
they say "the 14th". Locale formatting would also make the design record's
measurements unreproducible (DESIGN.md is measured, not remembered). The cost
is that an operator outside UTC reads UTC; a display timezone chosen per
project answers that additively, without a per-reader shape.

031 · 2026-08 · Navigation is icon-and-text, reversing #8's text-first ruling
(DESIGN.md §8). A resource may name its own mark: an optional `icon` on the
resource, one of a closed thirty-name vocabulary, defaulting to `table` — so
every definition written before this one keeps rendering, and a definition that
says nothing gets the generic mark rather than nothing at all. The glyphs are
drawn in-repo (#026) in `packages/ui`, and an unknown name is a validation
error naming all thirty (#020's "never truncated"). The rule #8 built the
ruling on is untouched and is the reason the slot exists: **the runtime still
never maps a resource key to a glyph.** A customer's resource may be called
`tbl_cust_01`, and picturing that from its spelling is the same mistake as
reading `suspended` and deciding it is an alarm (#029) — the definition says it
or nobody does. Why: #8 deferred this as "a future additive schema decision"
and it is additive exactly as predicted, so the cost of landing it is a
decision entry and thirty paths; and a sidebar of five bare words is the one
place the runtime looked less finished than the admins it is meant to replace.
The vocabulary grows additively; nothing in it may ever be removed.

032 · 2026-08 · A detail view says whether its related records are read
alongside the record or reached from it: `views.detail.relatedLayout`, one of
`inline | tabs`, defaulting to `inline`. `tabs` gives the record's own sections
one tab and every related list its own; validation refuses `tabs` with no
related lists, because one tab is a page.

This is the schema's first word about arrangement, and the line it does not
cross is worth stating plainly. It names which of two things the related
records *are* to this resource — part of reading the record, or their own
subject — and not how to draw either. The runtime still owns the tab, its
underline, its order, the panel and every pixel of both answers, and stays free
to render either differently tomorrow without touching a definition; that is
what #012's reversibility rests on. #010 admits "relationship context" as a
growth area gated on "can the runtime render it excellently for everyone?", and
both values can be.

Why: the runtime cannot see the difference and the author cannot avoid knowing
it. A user's orders are usually the reason the user was opened; an
organization's members are a list you go and look at. Left to the runtime the
only input would be a count, and choosing a screen from a count is guessing
about someone else's domain — the same mistake #029 refuses for badge severity.
The vocabulary is closed and grows additively; `inline` is what every
definition written before this one already meant.

033 · 2026-08 · A definition is authored as many files and submitted as one:
`repanel/app.json` (schemaVersion, app, navigation) plus
`repanel/resources/<key>.json`, one resource per file, filename equal to the
resource key. The single-file `repanel/definition.json` of #022 remains valid
as the degenerate case — three resources do not need a directory — and is
still what the repo convention means for a small app; this amends #022's
filename, not its ruling that the server is execution truth and the file is
reviewable source. Submission is unchanged and is not negotiable:
`submit_definition` replaces the whole draft, so the agent composes the files
into one object (resources sorted by filename, stably, because validation
error paths are indices into that array) before calling it. A CLI does the
assembly at MVP; until then the agent does, and writes the files regardless
because the files are what the customer reviews. Standardized in
docs/AUTHORING.md, which task 013 makes the guide every customer's agent
reads. Why: one file per resource is how a definition stays reviewable once it
is real — a resource is the unit a human changes, diffs and blames, and a
thousand-line JSON blob makes every change look like the same change. The
split costs nothing at the wire, because the wire never sees it.

034 · 2026-08 · The reference app is renamed skyscout -> crewbase, to avoid
collision with an unrelated real project of that name; its domain, tables and
acceptance scenario are unchanged.

035 · 2026-08 · Light is the entry theme on both of RePanel's surfaces, and
`packages/ui/src/tokens.css` is restructured into named theme layers sharing one
variable contract.

**The default.** An admin and its console both open light. The OS preference no
longer picks the first visit — only a stored choice of dark gets dark — which
is the one line that changed in each app's pre-paint script and theme hook. Why:
founder preference under real usage, which is the only evidence a default has.
A person who has never expressed a preference about this product is not
expressing one by having a dark editor open, and a default is the single design
decision every visitor sees whether they care about it or not.

**Dark's standing is unchanged, and that is deliberate.** It is the surface
ladder DESIGN.md §2 specifies, in the values §1 records, held to the contrast
floor §7 sets; it is named in full in every theme layer, shot on every
checkpoint, and reached by the toggle each shell carries — the console has one
now, which it did not before. Nothing about dark is deleted, deprecated or left
to rot into a fallback. What changed is which theme arrives unasked-for.

**The layers.** `tokens.css` is now three parts. Shared primitives (font stacks,
type scale, rhythm, radii) are identical everywhere and no layer may move them —
they are what makes the console and a customer's admin read as one product. The
colour contract is declared once as `@theme` names, holding no paint: each name
resolves one variable deeper, into a `--paint-` value. Then the layers —
`.theme-runtime` and `.theme-console`, one root class per app — each answer the
whole contract, in both themes. The console starts on the runtime's numbers
value for value, because that is what it has been drawn against; task 014b gives
it its own.

Why the indirection rather than a base palette the layers override: Tailwind
mints `bg-card` from a name in `@theme` and from nowhere else, so the contract
has to be declared there — and declaring values there too would make it a third
palette for the layers to drift from. Names in one place, paint in the layers,
and no copy of a palette that nobody applies.

Why layers at all, now, rather than when a customer asks: because the rule they
rest on has to be true *before* there is a second set of values, not after. No
component references anything but the contract's names; nothing outside
`tokens.css` reads a `--paint-` variable. A per-customer theme is then a further
layer of exactly this shape — the same names, its own values, applied after
these — and it works precisely because no component knows which layer it is
standing on. Enforced the only way a CSS rule like this can be: the contract is
the whole of what `packages/ui` exports as tokens, and a component that reached
around it would have to name a variable this file says is not for it.

036 · 2026-08 · The console's identity is the runtime's, on its own theme
layer. Task 014b ships concept F: `apps/web` spends DESIGN.md's palette, its
surface ladder **and its no-drop-shadows rule**, its type, its badge language
and its rhythm to the pixel, plus the sidebar anatomy
`features/runtime/sidebar.tsx` already has — with a cool-shifted chrome, which
#037 then took back to the runtime. DESIGN.md §11 is the record.

Three things the console has that the runtime does not, each because it is a
different app rather than a different design: a **project switcher** where the
runtime puts the app's name, because a console is always inside one project out
of several; **two nav groups** — `Project` for the four pages, `Account` for the
pair that is about the person — where the runtime's groups come from a
definition; and a **measure**, `--spacing-measure` 1100px centred in the panel,
because a table wants every pixel and a console does not.

**A page per concern, and which one you are on lives in the address.**
`/p/:id/overview | connection | agents | definition`, with `/p/:id` the way in.
Task 014 stacked the same three concerns in one scrolling column, which could
not be linked to, gone back from or reloaded into — the same three things #012's
tab rule and BUILD REQUIREMENT 1's filter rule already insist on for a screen.
A person in a console is somewhere, and a column has nowhere to say so.

**Overview holds nothing it fetches itself.** The setup checklist — connect a
database, mint a token, connect the agent, ask it — is derived on every render
from the three answers the other pages already ask for, so it cannot drift from
them. One derivation needed thinking about and is tested by name: a definition
proves an agent reached the project, because it cannot have arrived any other
way, so step four can never show done above step three undone.

**And the banned-defaults list is a gate on every surface, not a note on one.**
The list task 010 derived (`docs/design/concepts/README.md`) was written as "a
proposal, not a ruling" for that task's concepts. It is a ruling now, and it
applies at every design gate on every surface: **a concept that lands on it is
an automatic reject, and the answer is a restart rather than a refinement.**
014b's first console concept did — cream-paper chrome with a terracotta accent
is the named generated-design cliché, and it read editorial where a control
plane has to read like infrastructure — and it was restarted rather than
adjusted. It is kept as `concepts/console-a.html`, marked rejected, because a
list of banned defaults with no example of one being enforced teaches nothing.

037 · 2026-08 · The chrome is cool, on both theme layers. §1 ran it warm at hue
78 so that a screen whose content is a dense field of five hundred records would
read as chrome-vs-content rather than as two shades of one grey. Half of that
was right: the distinction is real and worth keeping. The wrong half was doing
the work.

Decided from pixels rather than from the argument. Task 014b's console proposed
a chrome on the data surface's own hue family at half its chroma — hue 74 → 265,
chroma .008 → .004, six tokens — and the runtime's own table page was then
rendered both ways and compared, same page, same layout, nothing else different
(`docs/design/shots/console-014b/runtime-chrome-{warm,cool}-{light,dark}.png`).
The cool one does not lose the distinction. **What carries chrome-vs-content is
the lightness step and the hairline** — .7737 against 1.0000 in light, .0019
against .0104 in dark, with `--sidebar-border` between them — and it always was.
What the hue was adding, on a screen this quiet, was being the loudest thing on
it.

So `.theme-runtime` takes the console's chrome and the two layers hold the same
values to the digit. They stay two layers: the mechanism exists so a *customer's*
can differ (#035), not so these two can, and a contract with one implementation
is not a contract.

Every lightness holds to within 0.002 of what it was, which is the whole reason
this could be taken back to the runtime without re-deriving §2's ladder — only
hue and chroma moved. The two sidebar text tokens moved with the surface they
are read on, because a warm text ladder over a cool ground reads as brown rather
than as quiet. The floor was re-measured on the running app rather than reasoned
about: 20 text styles light and 22 dark, zero below AA, tightest 4.74 / 4.79 —
both of them badges, at the numbers §4 records for them.

**`--primary` #bb4d00 is untouched, and is the point.** It is now the only warm
object anywhere in RePanel — the app's mark, the project's mark, and the one
control where there is exactly one thing to go ahead with. An accent that was
one warm thing among warm things is now the only one, which is what an accent is
for.

038 · 2026-08 · Actions gain a precondition: an optional `visibleWhen` on any
action, naming one field of the same record and saying exactly one thing about
it — `{ field, equals: <string | number | boolean> }` or
`{ field, isSet: true }`. The runtime reads it against the record on screen and
does not draw an action whose condition does not hold. This is the first rung of
#010's "fixed-vocabulary preconditions", and it is a rung and not a door: no
`and`, no `or`, no negation, no comparison between two fields, and never an
expression language. Anything one comparison cannot say is a rule, and #010
already says where a rule lives.

**Driven by checkpoint D.** Crewbase's `approve` calls an endpoint that refuses
anything not `pending` with a 409, and the admin drew that button on every
airline — so the honest answer to "approve an already-approved airline" was an
error toast. The definition knew the rule; it is written out in the `confirm`
sentence. It had no way to say it anywhere the runtime could read it.

**UI-only, and that is the whole of it.** The server does not enforce
`visibleWhen`. An action is still run by key, and what refuses it is what
refused it before — validation and the target column for a `dbUpdate`, the
customer's own endpoint for an `httpCall`. Both still refuse a request this
screen never drew, which is #027's defense in depth applied to a rule that now
has two statements of itself. The definition may be wrong; the endpoint may not.

**A precondition may not read a `sensitive` field.** Whether a button is drawn
is visible to everyone who opens the record, so a condition on a secret is the
interactive oracle #014 refuses a filter for — the same value probed one record
at a time, without ever rendering it. `hidden` stays legal: a precondition reads
a value and never renders one, and #014's line between a display flag and a
security one is not blurred here either. Hints name safe fixes only (#015).

**"Exactly one condition" is a referential check, not a union.** The schema
admits both keys and the second pass refuses zero or two of them, because a zod
union failure can only say the object matched no arm, and #008 is worth more
than a tighter inferred type. Saying both is the mistake worth its own sentence:
it is where an author starts writing a rule in the wrong file.

Additive by construction (#012): an action with no `visibleWhen` is offered
exactly as every action written before this one was.

039 · 2026-08 · `visibleWhen`'s `equals` is typed at validation. It is legal
against a `text`, `enum`, `boolean`, `number`, `email` or `url` field, and the
literal must be of that field's own type — a string for the three string types,
a number for `number`, `true` or `false` for `boolean`, and for an `enum` one of
its declared values, which is the check #038 already shipped. Against a
`relation`, `json`, `date`, `dateTime` or `longText` field it is an error, and
the hint offers the two real fixes: ask `isSet`, or move the rule to the
endpoint (#010). `isSet` stays legal on every field type, because "does this
record hold anything here" is a question every type can answer.

**The class this closes is a button that is never drawn and never explained.**
`{ "field": "created_at", "equals": "2026-08-01" }` parses today. It then
compares an ISO string the runtime rendered as `1 Aug 2026` against a literal an
author wrote by hand, never holds, and the action vanishes from every record —
no error, no log, nothing on the screen that could be read as a problem. The
same is true of a `relation`, whose value on the wire is `{ id }` rather than
the key; of `json`, where equality is structural; and of `longText`, which holds
prose. #008 says a definition's problems are answered at validation with a path
and a fix, and this was a problem that reached production silently instead.

**Narrowed now because now is when narrowing is free.** #012's ratchet closes
against external definitions, and there are none: the only `visibleWhen` in
existence is the fixture's, crewbase's `approve`, and whatever this repository
writes. Both are `enum`/`equals`. After the first customer definition ships, the
same change is a breaking one and would need a `schemaVersion` — so the rung is
cut to shape before it bears weight, not after.

**`longText` is refused, and the allow-list is why.** It is a text type and
`isTextField` counts it, so it could have been let through on the strength of
its typeof. But the list of comparable types is closed rather than open, and a
long-text column holds a paragraph: an `equals` against one is the same
never-holds comparison in a friendlier shape. A type joins the list by being
asked for.

**No negative form, deliberately.** There is no `isSet: false` and no
`notEquals`. #010's ladder grows a rung at a time and this rung has been
standing for one task; a negative is also where the rule-shaped condition
starts, because "not approved" is usually three states rather than one. It is
recorded as a limitation in SCHEMA.md rather than left to be discovered, so an
authoring agent reads the absence as an answer instead of trying it.

040 · 2026-08 · Every address of a RePanel surface comes from validated
environment, and nowhere else. The API declares three — `API_URL`,
`CONSOLE_URL`, `RUNTIME_URL` — through one `surfaceUrl` shape that requires a
URL, defaults to the development port and drops a trailing slash once, so a
link built by concatenation cannot grow a double slash in one deployment and
not another. Each Vite app gets the same set it actually needs in a single
`src/config/env.ts`, read from `import.meta.env` with the identical defaults.

**The rule is spatial, which is what makes it checkable.** No file outside those
env/config modules may contain an absolute http URL literal naming one of our
own surfaces. The MCP setup snippet, `connectionSetupUrl`, "Open admin", the
CORS allowance and the runtime's console-login link all read config now, and one
grep over `apps` and `packages` says so:

```
grep -rnE "https?://(localhost|127\.0\.0\.1)" --include='*.ts' --include='*.tsx' apps packages \
  | grep -vE "src/config/env\.ts:|src/config/env\.schema\.ts:|vite\.config\.ts:|\.spec\.tsx?:|\.test\.ts:"
```

The exemptions are the config modules themselves, Vite's own config — which is
a config file and holds only the dev proxy's target — and tests, where a URL is
the case's data rather than a deployment's address.

**Prerequisite rather than tidying.** Hosted RePanel has three origins and not
one of them is localhost, and the single worst place for a wrong one is the MCP
snippet: a customer's agent is configured from it once, by copy and paste, and a
literal that was right on a laptop is then wrong in a way nothing on the screen
reports. The same is true of the CLI this precedes. A URL that lives in exactly
one validated place is configured, and a URL compiled into a component is not.

**CORS is derived rather than declared.** The two browsers reaching this API are
the console and the runtime, so the allowance is exactly `[CONSOLE_URL,
RUNTIME_URL]` with credentials — it cannot drift from where those surfaces are
deployed because it is read from the same two variables that put them there.
Development never needed it and still does not: both Vite servers proxy the API
onto their own origin, which is why this arrives now, with the first deployment,
rather than earlier.

**`API_URL` is declared with no in-process reader.** Nothing on the API prints
its own address today — the console writes the setup snippet from its own Vite
env. It is stated anyway because a deployment configures its surfaces as a set
of three, and a deploy contract with a hole in it is filled in by guessing.

041 · 2026-08 · RePanel has a motion vocabulary of two durations and one
easing — `--motion-fast` 120ms, `--motion-base` 180ms, `--motion-ease`
`cubic-bezier(0, 0, 0.2, 1)` — spent on a closed list of seven places, with data
surfaces banned from motion outright. DESIGN.md §12 is the record. The list is
hover/focus/active-nav colour (fast); the dialog and its backdrop, the
date-range popover and a toast, all **enters only** (base, fade up over 4px, no
exit); the theme swap (fast); and a checklist step turning done (fast). A table
row, a sort, a filter, a page change and a record load are instant.

**Founder-driven, and post-D.** Nothing asked for this. The design record ran to
eleven sections and 700 lines without the word *motion* in it, which meant the
product shipped whatever its libraries defaulted to — measured before the
change, every `transition-colors` in RePanel was running at Tailwind's 150ms on
`cubic-bezier(0.4, 0, 0.2, 1)`, an ease-**in**-out. A hover that starts slowly
is the one hover a product like this cannot have, and nobody had chosen it. The
absence of a decision was itself functioning as one.

**Why a closed list rather than a principle.** "Use motion sparingly" is not
enforceable and does not survive contact with a hundred call sites. A list is:
a new place for motion is an edit to §12 and an entry here, and until then the
answer at the call site is no. It is also auditable in one line, the way #040's
URL rule is —

```
grep -rn "animate-\|transition-\|duration-\|ease-" --include='*.tsx' apps packages
```

— which today returns eighteen lines, every one of them traceable to a row of
§12's table. Expanding the list requires a decision entry; that is the whole
point of writing it down as closed.

**The ban is the substantive half.** Motion on a data surface costs twice: it
delays the value by the length of the step, and it moves the eye to the fact
that something changed rather than to what it now says. An operator reading a
row before acting on it is under time pressure precisely when it matters most.
The ban also protects the signal: because nothing in the data panel ever moves,
a toast rising in the corner reads as an event rather than as the screen
breathing. Three defaults were removed to make the ban true rather than
declared — the table row's `transition-colors`, the skeleton's `animate-pulse`,
and the JSON block's rotating chevron. Each was a library's opinion that had
never been ruled on.

**Two mechanisms, both in `tokens.css`.** Tailwind's own
`--default-transition-duration` and `--default-transition-timing-function` are
answered with the vocabulary, so a bare `transition-colors` written anywhere
lands on 120ms ease-out instead of on the library's default — the vocabulary is
the floor, not something each site has to remember. The enter is a token too:
`--animate-enter` plus a keyframe in `@theme`, spent as one `animate-enter`
utility, so the dialog, the popover and the toast cannot drift from each other.

**The theme swap is the one exception to the ban, and it is bounded in time.** A
theme belongs to the whole screen, so a crossfade stopping at the data panel's
edge would be half a screen changing and half snapping. `useTheme` marks the
document immediately before the class flips and unmarks it after the fast step;
outside that window the rule matches nothing. The cost is the vocabulary's one
duplicated number — 120 written in each app's hook, because what arms the
crossfade is an attribute on the document rather than a rule in the stylesheet.

**Reduced motion is answered twice, deliberately.** The two durations are
redeclared as `0ms` under `prefers-reduced-motion: reduce`, which empties every
token that spends them — including the dialog backdrop's fade, which lives on
`::backdrop` where the universal selector cannot reach. The pre-existing blanket
reset stays for whatever never asked the vocabulary for a number. That rule had
been in the file since #028 with almost nothing to collapse; it has something to
collapse now, which is why it was checked rather than assumed.


042 · 2026-08 · The chrome is light, flat and achromatic — `#f3f3f3` in light,
on both theme layers. Four chrome tokens and the two sidebar text tokens move
with it: `--sidebar-accent` `#f3f4f7` → `#ffffff`, `--sidebar-border` `#cfd1d4`
→ `#dcdcdc`, `--sidebar-foreground` `#434548` → `#454545`, `--sidebar-muted`
`#5e5f63` → `#5f5f5f`. The top-to-bottom fall is gone: both stops hold the same
value. Dark is untouched.

Why: #037 closed the hue question by finding that the lightness step and the
hairline, not the temperature, are what tell the chrome from the content. Taken
seriously that is also a claim about *weight* — the chrome only has to be a step
below the panel, and `#e2e4e6` was a mid grey framing white, the second-loudest
thing on a screen whose loudest thing should be the data. `#f3f3f3` is six
lightness points lighter, which halves the step (.7737 → .8963 against the
panel's 1.0000), so `--sidebar-border` is re-derived deeper (−6.7 → −8.0 L* off
the chrome) to carry what the step no longer does alone. `--sidebar-accent` was
always the lighter-than-chrome token; the lightest value available is the
panel's own `#ffffff`, so the selected resource now lifts to the surface its
content is on. The fall is dropped because 2.8 lightness points on a 90.5 ground
is a third of a step on a 95.8 one — invisible, and one more value a customer
layer would have to answer. `--sidebar-top` and `--sidebar-bottom` stay two
tokens and the shells still paint a gradient, so a layer that wants the fall has
it for a value.

The two sidebar text tokens are re-derived at their predecessors' own lightness
(L* 29.2 → 29.3, 40.4 → 40.3), so the ladder's steps are unchanged and only the
family is: at this lightness the content's hue family is indistinguishable from
none, which is why the flat grey is not a reversal of #037. Both layers move
together for the reason they were converged in the first place — one product,
one chrome (#036, #037). The AA gate was re-derived and every affected ratio
improved, because the ground got lighter and the text on it did not:
`--sidebar-foreground` 7.44 → 8.64:1, `--sidebar-muted` 4.88 → 5.75:1. Nothing
inside the panel changed, so §4's ratios stand.

043 · 2026-08 · The sidebar's ladder is re-derived against a measured reference,
and the reference is a screenshot the customer of this design pointed at. Ground
`#f3f3f3` (already ours, to the digit). Pill `--sidebar-accent` `#e9e9e9`, which
is *darker* than the chrome. Three text rungs: `--sidebar-muted` `#6b6b6b`,
`--sidebar-foreground` `#5a5a5a`, and a new `--sidebar-strong` `#111111` for the
current item, the app name and the account name. The current item also takes
`font-semibold`. Icons take their own label's ink rather than 70% of it. Dark
mirrors all of it: `#7e8084`, `#9fa1a5`, `#f2f3f3`, pill unchanged at `#161719`.

Why, and what it corrects: the reference was sampled rather than eyeballed, and
it contradicted three things this record believed.

**The pill goes darker, not lighter.** #042 reasoned that `--sidebar-accent` had
always been the lighter-than-chrome token and so should become `#ffffff`. On a
`#f3f3f3` chrome that is spending the scarce direction — there are 4.2 lightness
points of headroom above the ground and 95.8 below it. The reference spends the
plentiful one, at −3.5. Dark already did this correctly and is untouched.

**The current item is near-black, and that is not the chrome competing with the
data.** The first draft of this entry set `--sidebar-strong` to a dark grey on
the rule that the chrome's darkest ink must stay lighter than the panel's. The
reference measures `#0c0c0e` — the panel's ink, near enough. The rule was right
about the risk and wrong about the mechanism: what would make a sidebar compete
is the *quantity* of dark ink, not its value. One black label among five greys
is a focal point; five would be a second table. So the constraint moves off the
colour and onto how many things may wear it — the current item, the app's name,
the account name, and nothing else.

**The rest of the list sits further back than it did.** At-rest ink measures
L\* 38.1 in the reference against our `#454545`'s 29.3. Pushing the four
unselected items back is what buys the selected one its black; the two changes
are the same decision. `--sidebar-muted` follows to `#6b6b6b` (L\* 45.2) to keep
a step under it — the reference uses *no* colour step there at all, setting the
group label in the same ink as the items and separating them by size alone, but
DESIGN.md §3 records that exact arrangement being built here and read as another
destination, so the step is kept.

**Three signals, so each can be quiet.** The current item is carried by the pill,
the ink and the weight together, which is why none has to shout. The weight is
stated once per branch rather than overridden, because the runtime's sidebar
joins its class list instead of merging it and `font-medium font-semibold`
would otherwise leave stylesheet order to decide. Hover takes the pill and the
ink but *not* the weight: a route change may reflow a label, a pointer crossing
one may not.

**Icons stop being dimmed.** `opacity-70` put the resting glyph at an effective
`#797979` — lighter than the group label that outranks it, and 3.92:1. The
reference sets each glyph in its own label's ink, which is also the right answer
to "the glyph is how the eye finds the word": a mark that is harder to see than
its word is not helping. The account chip drops the hairline #042 gave it, since
`--sidebar-accent` now has a fill with presence of its own.

Ratios, light: `--sidebar-muted` 4.80:1, `--sidebar-foreground` 6.22:1 on the
chrome and 5.68:1 on the pill, `--sidebar-strong` 17.02:1 and 15.55:1. Dark:
5.12:1, 7.82:1 / 6.93:1, 18.21:1 / 16.14:1. Floor is 4.5.

**And the rhythm, measured from the same screenshot.** Its pill is 159px against
a 174px row pitch — it holds its label at 1.9 ems where this design ran 2.2, and
spends the difference as a 15px gutter between rows where this design had one
pixel. So the air moves out of the rows and in between them: `--t-nav` 14px (new,
was `--t-body` 13.5), `--t-brand` 15px (was 14, so the app's name stays a step
above a nav item), `--h-nav` 32px (was 30), `--h-nav-gap` 3px (new, was
`gap-px`), and 8px under a group label instead of 4. A list of five destinations
should read as five items rather than as a block, and a gutter says that where a
taller row does not.

`--t-nav` is its own size rather than a bumped `--t-body` because the two answer
different questions: a table cell's size is set by how much of a record fits on
a screen, a nav item's by how fast a destination can be found. They were the same
number by coincidence. It joins `--t-brand` and `--t-nav-meta` as the sidebar's
own three, outside the five that §3 fixes.

044 · 2026-08 · docs/BACKLOG.md created as the post-MVP ladder's single
home — chat ideas land there or die; the decision log records rulings,
the backlog records sequenced intent. Items graduate to numbered tasks
per #010's gate; nothing in the backlog is a commitment.

045 · 2026-08 · The CLI takes no argument-parsing dependency: `repanel` is
dispatched with Node's own `util.parseArgs` (task 018 allowed one parser).
Why: four commands and `--help` are the whole surface, the platform already
refuses an unknown option, and the CLI is the package a customer installs —
its dependency list is read by strangers.

046 · 2026-08 · Assembly composes resources in navigation order first, then
every unlisted resource by key — not by filename alone. Why: the sidebar's
order is the one a human already has in their head, so `resources[2]` in an
error is the third thing they see; unlisted resources still need a total
order, and their key is it. AUTHORING.md §3 still describes hand assembly as
sort-by-filename and is now a step behind the CLI.
