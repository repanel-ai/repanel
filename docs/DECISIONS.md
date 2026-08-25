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

047 · 2026-08 · Navigation must reach every resource: validation refuses a
definition where a resource key is not listed in exactly one navigation group.
An unlisted resource is reported at the resource, a repeated one at the entry
that repeats it, and both hints name the repair before the removal (#015).

Why: the sidebar is built from `navigation` alone, so a resource no group lists
is declared, stored, served — and never offered to the operator the admin was
built for. That is the silent degradation #008 has no answer for, which is the
same argument #027 made for the two containment checks it moved into
validation; what was missing here too was the repairable error that says so.
The other direction costs nothing to close at the same time: one resource
listed twice is two sidebar entries onto one page, both lit whenever either is.

**It narrows, and the ratchet is why it lands now.** A definition that relied on
the gap becomes invalid without a `schemaVersion` bump — legal only while #012's
ratchet is open, and this is the third narrowing to spend it (#027, #039).
Revalidation makes it retroactive rather than prospective: `RuntimeService`
re-validates the stored draft on every read, so a stored admin with one unlisted
resource does not lose that resource, it stops rendering altogether. That is the
strongest reason to spend the ratchet now, before an external definition exists
to break.

**"Offered nowhere", not "reachable by nowhere".** The runtime resolves
`r/:resourceKey` out of `resources`, never out of `navigation`, so an unlisted
resource still renders when a relation link or a typed address lands on it. What
it has no way of is being found. The rule therefore ends the lookup-resource
pattern — a resource kept out of the sidebar and reached only through a
relation — which was legal until now and has no opt-out. If that pattern is
wanted back it returns as an additive flag, never by relaxing the check.

**AUTHORING.md §3 gains the rule; the assembler keeps the unlisted tail.** #046's
composition order still ends with every unlisted resource by key, and that tail
is now load-bearing: it is what carries an unlisted resource into `resources[]`
so validation can refuse it at a path. An assembler that dropped it would delete
the resource instead, which is the degradation this check exists to close.

048 · 2026-08 · `repanel dev` serves the same product, not a sibling. One
process on loopback is at once the static host for the runtime bundle, the data
API it reads, the action runner and the watch channel — one origin, so the
app's relative `/api` client reaches it exactly as it reaches the hosted API.
Nothing in `apps/runtime` changed to make this work, and nothing may.

**One bundle, and local arrives as served config.** The runtime is built once
and copied into the CLI at build time; `repanel dev` serves that file
unmodified. There is no local build, no forked entry point and no `if (local)`
anywhere in the app — the difference is entirely on this side of the wire, in
what the server answers. Auth is the case that proves it: `/auth/me` is
answered with a synthetic local operator, so the app's session path runs the
code it always runs and finds somebody there. A local difference that cannot be
expressed as an answer is a signal to stop, not to branch.

**Zero third-party dependencies, per #045.** `util.parseArgs`, `util.parseEnv`,
`fs.watch({recursive})`, `node:http` and Server-Sent Events cover the whole
command; the CLI's dependency list gains only `@repanel/engine`, and `pg` stays
the engine's to declare. The one thing written by hand is a reader for
`filter[x][from]`, which Express nests before the schema sees it and
`URLSearchParams` does not.

**#045's premise widened, and is worth saying out loud.** Its reasoning was that
"four commands and `--help` are the whole surface". The surface is now four
commands, `--help`, and `dev`'s three options — `--port`, `--database-url`,
`-y/--yes` — which `parseArgs` still refuses to confuse: an option is rejected
where the command that takes it is not the one named. The ruling stands; the
sentence it rested on has one more clause in it.

**Zero egress, proven twice.** A source gate reads every file of the package and
refuses an address off this machine, an outbound client, or the name of a
RePanel service; and the server's whole request cycle is exercised in a spec
with every non-loopback socket refused at `net.Socket.prototype.connect`. The
only calls out of the process are the database the operator confirmed and the
endpoints a definition's own `httpCall` actions declare.

The socket guard has a spec of its own, and the reason is worth keeping. Its
first version read only `socket.connect(options)`; `net.connect(...)` — which
is what `fetch`, `http.request` and `pg` all arrive through — normalizes its
arguments into a single `[options, callback]` array first, so every plain-HTTP
request went through a guard that reported nothing, and the case asserting the
guard could fail used the one shape no client library produces. A proof that
cannot fail proves nothing, so the ways this one must fail are now written down
as tests, and a connection whose target cannot be read is refused rather than
allowed.

**The overlay is the CLI's, injected, and never fatal.** A definition is only
swapped for one that validated, so a broken edit leaves the admin drawn,
answering and interactive while the overlay names the problems — the same
file/path/message/expected/hint `repanel validate` prints, with the assembler's
own source filenames. The client is a script the server adds to the document as
it serves it; putting it in the bundle would be a development branch in the
product. An invalid definition at startup is refused instead: there is no last
good render to protect, so it is a `validate` run that did not open a port.

**The action secret is generated per run and printed once.** Nothing is written
to disk. The operator pastes it into their application's environment and
restarts it; until they do, every signed action is refused, which is the
verification working. A development secret that persists is one that eventually
ships.

**Publishing the embedded asset has no task yet, and that is the note.** The
copy step is enough for this repository, where pnpm builds the runtime first.
What an installed package carries — the `files` list, whether the bundle ships
in the tarball, how a consumer without the monorepo gets it — is release
engineering, and no task owns it: 021 excludes npm publishing by name, 024 is
the README, and 025 is definition snapshots rather than package ones. It is
deferred rather than improvised, and it needs a home before the CLI is
published.

049 · 2026-08 · `repanel link` and `repanel deploy` reach RePanel, and the
connection string reaches it through them: environment → CLI → API, over a
session a human authorized in their own browser. It passes through no agent, no
log, no file and no argument, and `link` deliberately takes no `--database-url`
— the flag `dev` has is a local convenience and would be a shell-history leak
here.

**The sign-in is a loopback callback against the console's session.** The CLI
opens a port on `127.0.0.1`, generates a nonce, and sends the browser to
`<console>/cli?port=…&state=…`. That page is behind the console's own guard, so
a signed-out human signs in first and comes back to it — which is why
`RequireAuth` now carries the address it was protecting to `/login`, a fix the
MCP tools' project deep links needed too. The page asks for one press, mints a
session against the one it already has (`POST /auth/cli`), and redirects to the
loopback port with the token.

The token is in that redirect's query, and that is the considered choice rather
than an oversight. The alternatives each cost more than they save: a one-time
code needs pending-authorization state in the API, PKCE needs the same plus a
challenge, and a form POST to loopback is blocked as mixed content in at least
one browser. What the redirect actually exposes is one entry in the visited-URL
store of the browser that *already holds the session cookie that minted it* —
strictly less than what is there. Against that: the nonce means a page that
navigates to a guessed loopback port is refused and the wait continues, the
listener takes exactly one callback and closes, the console builds the address
from a fixed host and a parsed integer port (so a `port` naming a hostname
delivers nothing anywhere), and the console page never pushes a history entry.

**The CLI holds a session, not a token it minted.** It is an ordinary session
row — same 30 days, same table, ended by the same logout — stored in
`~/.repanel/session.json` at mode 0600 together with the API that issued it, so
pointing the CLI at a second deployment never sends it the first one's
credential. `.repanel/project` in the repository holds the project key and
nothing else, which is what makes it committable, and it must be committed: it
is how the next clone deploys to the same project.

**Where RePanel is comes from the environment, not from the repository.**
`REPANEL_API_URL` and `REPANEL_CONSOLE_URL`, defaulting to the development
deployment. A committed file that named an API would deploy somebody's staging
by accident on the next clone.

**`deploy` submits over the user's own session, through a route that had to
exist.** `PUT /projects/:id/definition` is the human's equivalent of the MCP
`submit_definition`, and it answers with the verdict — the work list when
invalid, the admin's address when valid. The address is answered rather than
composed by the CLI: where the rendered admin lives is a fact about the
deployment, and it saves the CLI a third address to be configured with. The
errors come back as paths in the composed object and are moved into the file
that supplied each one, so `deploy` and `validate` print the same four lines
from the same function.

**The zero-egress gate was re-derived, not deleted.** #048's gate read every
file in the package and refused an outbound call anywhere in it. That statement
stops being true the moment the package gains a cloud client, so the promise
moved from a directory to a module graph: everything reachable from
`commands/dev.ts` (plus the overlay the server hands the browser) is followed
and gated. To keep a proof that can fail, it also asserts what must be *inside*
the closure — nine modules `dev` is made of — and what must be *outside* it:
`cloud/api.ts`, `link` and `deploy`. `bin.ts` and `cli.ts` are outside by
necessity, since they import every command, and are checked separately for
making no call of their own.

**One spelling for a database.** `describeDatabase` now renders
`localhost:5433/crewbase` rather than `crewbase@localhost:5433`, which is what
the console's connection card already showed and what `link` asks about. `dev`'s
banner changed with it: three surfaces naming one fact should name it once.

050 · 2026-08 · The notice stack belongs to the app, not to the screen that
raises one. `packages/ui` owns a `<Toaster>` — a provider and one fixed column —
and anything under it raises a notice through `useToaster()`. Why: a notice is
about something that has *already happened*, so it must outlive whatever caused
it, and nothing that can be unmounted may be the thing holding it.

**This is a regression fix, and the regression is worth writing down.** 012
shipped confirm → pending → success toast → badge flip, and #038 (`visibleWhen`)
broke the last two halves apart without touching either. `RecordHeader` had
guarded the action row with `resource.actions.length > 0`, a fact about the
definition; #038 made it `visibleActions(resource.actions, record.values)`, a
fact about the record on screen. The notices were `RecordActions`' own `useState`.
So a success invalidated the record, the refetch returned the state the action
had just set, the last visible action stopped applying, and the header unmounted
the component holding the notice about it — on the very refetch the success
triggered. The account of a success was destroyed by the success.

It survived review and its own test suite because the shared fixture's `users`
declares three actions and only one of them says when it applies: there was
always an unconditioned button left, so `RecordActions` never actually
unmounted. The spec that would have caught it is the one that narrows the
resource to a single conditioned action, and it is now there
(`record-page.spec.tsx`, "goes on saying it is done when the success left
nothing to do to the record").

The lesson is not "check the guard". It is that ownership of a notice was wrong
from 012 onward and the guard only made it visible: a component that can be
taken off the screen by the outcome it is reporting cannot be the component
storing the report.

**Three tones, and they are the badge language's own (#029).** `positive`,
`critical` and `neutral` — the same names on the same tints, so a state in a
table and a notice about changing it are told apart the same way. `attention` is
built for badges and unspent here; nothing raises one. Each tone also carries a
16px mark — check, alert, info — so the tone is legible before the colour is
(DESIGN.md §7).

**Every notice clears itself, reversing 012's "a failure does not".** Success
and neutral 4s, failure 8s. The stack is bounded at three and a notice with no
clock holds one of those three against every notice after it. Pointing at the
stack or tabbing into it stops every clock in it and resumes what was left
rather than restarting, which is what makes the shorter failure honest — the
eight seconds are eight seconds of nobody reading it. Dismiss stays on every
notice, which is the promise 012 actually made.

**The clock is a timer, not the end of an animation.** `prefers-reduced-motion`
collapses the vocabulary to `0ms` (DESIGN.md §12) and a notice still goes when
it is done. Reduced motion is reduced movement; it is not reduced function, and
a corner that fills up for somebody who asked for less movement would be exactly
that.

**Top right, under the topbar — and the corner is an open question.** DESIGN.md
§10 records the placement and its open item both. Both shells put chrome in that
corner, so the stack clears `--spacing-top` rather than starting at the window's
edge; but the record header's action row is right there too, and a notice covers
the buttons it is about. Three corners are spoken for and bottom right — 012's —
is the only free one. The shots are the evidence; the ruling is not made here.

**The one sentence the runtime adds to an account it did not write.** A refusal
naming 401 or 403 gains: *If running locally: set the dev action secret printed
at repanel dev's boot.* RePanel signs every outbound action (#013), `repanel dev`
generates that secret per run, and an application that has not been given it
refuses in exactly this shape. The status is read back out of the engine's own
sentence because it is the only place it survives — the four categories a
browser is told are deliberately coarse and a customer's response body is never
forwarded — and `http-call.spec.ts` now pins that sentence from the other end.
It says *if* rather than checking, because #048 means there is nothing to check:
`repanel dev` serves the same bundle the hosted product serves.

**The console gets the stack and almost no notices.** Every console failure
belongs beside the control that caused it and already has a place there —
`FormError`, the connection test's own status line, `CopyButton`'s confirmation
— and moving those into a corner would take the account away from the control it
belongs to. The one outcome with nowhere to be said is creating a project: the
dialog closes and the browser leaves for the new project before the result is
known. That is the same shape as the regression above, which is the test of
whether a notice is the right answer.

051 · 2026-08 · `repanel dev` has a terminal voice, and it is five marks and two
weights. `terminal.ts` owns it: `label` for a gutter's quieter half, `headline`
for the one line that is the point of the screen, and `✓ ⚠ ✗` for a thing that
went well, wants doing, or did not go. No dependency — an SGR code is five
characters and a colour library is a supply chain (#045).

**There is no palette and there will not be one.** A terminal is somebody else's
theme: their background, their sixteen colours, their contrast. The only
distinctions worth drawing on top of one are which text is a label, which line
is the point, and which of three things happened — and every one of them is
legible with the colour taken away, because the marks and the gutters are the
design and the colour is emphasis on it.

**Colour is decided once, at the edge, from two answers neither of which is
ours.** `colorsAllowed(isTerminal, env)` — a terminal that can render it, and
NO_COLOR (set and non-empty, whatever it is set to) asking that it not be —
computed in `bin.ts` and carried as one boolean on `Terminal`. A command never
reads `process`. Colour off is the identity function on every method, so the
degraded output is the same layout with none of the codes in it rather than a
second layout to maintain; both are tested, and so is the decision.

**The secret is left bare on its own line.** It is going to be selected with a
mouse and pasted into a file, and a colour code either side of it is a thing to
accidentally take along. Same for the masked DSN in the confirmation, which
keeps the masking it already had.

**One gutter, and the label is padded before it is dimmed.** An escape code is
not a character an eye can see but is very much a character `padEnd` counts,
which is why the gutter is built by a function rather than written out line by
line.

**A save says one line, and its problems sit under it.** `reportWhileServing`
counts first and lists after — the opposite of `validate`, which counts last —
because what an operator needs to know while a server is up is that the screen
in front of them is still the last good render. `reportReloaded` is its other
half. Both live in `problems.ts` beside `reportProblems`, so the three
renderings of one problem cannot drift.

052 · 2026-08 · A notice is a card with a shadow, and it leaves. Three changes
to #050's toast, and two of them reverse rules that were written as rules.

**The tone is ink, not paint.** The tinted fills are gone: every notice is one
surface — `--card`, a `--border` hairline — and what tells the tones apart is
the 16px mark and the title's colour. A tinted block floating over a data panel
reads as a coloured hole in the page rather than as a thing above it, and the
fill was buying that at a real price: every contrast ratio in §10 improved when
it went, because a tint is a step toward the ink standing on it. Measured, light
/ dark: positive 4.74 / 4.94 → **5.41 / 5.61**, critical 5.12 / 4.79 → **6.09 /
5.45**, description 16.56 / 12.78 → **19.71 / 14.54**. The mark is carrying more
of the signal than it used to, which is the right thing to be carrying it — a
shape is legible to a reader a colour is not (§7).

**#026's no-drop-shadows rule gains one bounded exception, and it is this.**
DESIGN.md §2 says elevation is stated by lightness and a hairline and that there
are no shadows anywhere. That rule is about elevation *within* the page, where a
rung of the ladder says it better than a blur does. A notice is not on the
ladder — it is over the page, briefly, and then gone — and in light there is no
lightness left to spend on it either: `--card` and the panel are both `#ffffff`,
so a hairline is the whole of the edge and a white card on white reads as a
rectangle drawn on the panel. `--shadow-lifted` is declared once in the colour
contract, has a value per theme layer like every other paint, and the toast is
the only thing that spends it. Anything on the ladder taking it is a regression.
The radius goes with it: `--radius-lg` 7.2px → `--radius-xl` 10.08px, the
dialog's and the panel's, because it is now the same kind of object as they are.

**#041's "enters only" gains a notice, and only a notice.** §12 ruled that a
dialog, a popover and a toast arrive and never leave, and called it a rule
rather than a simplification. It stands for the dialog and the popover, for the
reason it was made: they close because somebody closed them, and that person is
already looking at what was behind.

A notice is not that, and the difference is who ended it. A notice mostly ends
**on its own clock, with nobody having asked** — and a thing that vanishes
unbidden between two frames reads as a glitch rather than as an ending. The
120ms it takes to go is not time spent waiting; it is the only signal that
something finished rather than broke. It is bounded to keep it honest:
`--motion-fast`, the shorter step, because leaving is quicker than arriving; the
same single ease-out; and the exact reverse of the enter, so the pair is one
gesture and its undo rather than two ideas. The stack does **not** animate
closed — the notice holds its place until it has gone and the ones under it come
up instantly, because that is layout, and layout stays banned from motion.

**The exit is a timer, and it is asked about.** What removes the element is
`setTimeout`, not `animationend`, for the reason the auto-dismiss already was:
the end of an animation is not a thing that reliably happens. And
`prefers-reduced-motion` is read rather than assumed — where it is set there is
no 120ms to sit through, so a dismissed notice goes at once instead of holding a
place for an animation that is not playing. §12's promise that reduced motion
takes the movement and leaves the function now has two halves that keep it.

053 · 2026-08 · The repository is multi-licensed by package, and the line is
drawn between what customers build against and what RePanel operates. MIT for
`packages/contracts`; Apache-2.0 for `packages/engine` and `packages/cli`;
AGPL-3.0-only for `apps/api`, `apps/web`, `apps/runtime`, `packages/ui`, and as
the repository's default for anything not otherwise marked; MIT for
`examples/crewbase`. Every package states its identifier in `package.json` and
carries the verbatim text; `LICENSES.md` at the root is the map, and
`docs/LICENSING.md` (022) is the plain-language version. Contributions come in
under a DCO sign-off, never a CLA — contributors keep their copyright.

**The engine is Apache-2.0 rather than AGPL, and that is the ruling worth
recording.** The first proposal had it copyleft on the reasoning that it is the
runtime core. That reasoning is wrong about where the moat is: the engine has to
be embeddable — `repanel dev` runs it on a developer's machine and the connector
(031) will run it inside a customer's network — and those are the activation and
enterprise-trust surfaces, the two places where an AGPL-policy conversation
costs a customer we would otherwise have had. The moat is runtime quality and
Cloud operations, never secret code. The MIT-contracts precedent already settled
the principle for the surface a customer's agent writes against; the engine is
the same argument one layer down.

**The dependency-mixing question, and why it disappeared.** A permissive CLI
that links an AGPL engine is a combined work distributed under AGPL, so the
"maximally permissive CLI" and "protected engine" goals were in direct conflict
while the engine was copyleft — flagged for sign-off rather than resolved
quietly, and resolved by moving the engine. `packages/cli` imports
`@repanel/engine` as values in five files; both are Apache-2.0 now, and the
question does not arise.

**One thing the map cannot say by itself.** `packages/cli`'s build copies the
compiled `apps/runtime` into `dist/runtime` (#048: one bundle, not a sibling),
so a *built* CLI carries AGPL code beside its own Apache-2.0 code. Nothing
attaches to running it; it matters only to whoever redistributes a build, and
`LICENSES.md` says so plainly rather than leaving a scanner to discover it.

**No per-file SPDX headers.** The authority is the package's `LICENSE` plus its
`package.json` `license` field — two places both a scanner and a human already
read, which cannot drift from each other the way thousands of copied header
comments can. New packages need both; new files need neither. Stated in
CONTRIBUTING so the rule is findable, not retrofitted into the tree.

054 · 2026-08 · Security posture is published: docs/THREAT-MODEL.md
states every guarantee with its enforcing mechanism and hands readers
the verification commands (§7, each run before being quoted); residual
risk names the direct-DSN trust assumption plainly with the connector as
the structural answer. The document is maintained as a claim surface —
a change that falsifies a stated claim must update the document in the
same change.

055 · 2026-08 · Writes are opt-in twice: a resource declares `writes`
(`create` and/or `update`, both defaulting to false) and a field declares
`editable`. Neither half is inert — a field marked `editable` on a resource
that offers no write is a validation error, and so is a `writes` with nothing
editable under it. `readOnly` is retained as the assertion every v0 definition
already makes, is only ever `true`, and may never accompany a write; the
referential pass answers `readOnly: false` by pointing at `writes` rather than
letting a literal failure hint at the wrong fix. The writable types are every
type but `json`; `sensitive` fields, the `primaryKey` and `json` fields can
never be editable. `delete` is deliberately absent and is additive when the
audit log that makes it accountable exists (#028).

**Two declarations rather than one, and it is not redundancy.** They answer
different questions. The resource's is "does this admin write here at all",
which is a posture; the field's is "may a human type into this column", which
is a fact about the column. Collapsing them would mean a form's field list
doubles as the grant, and adding a field to a form would silently widen what
the admin may write — the exact accident #007 deferred forms to avoid.

**Loud in both directions, because a half-opt-in is the dangerous state.** The
inert reading — ignore an `editable` that no `writes` backs — hides an author's
belief that they opened a form until an operator finds a screen with no
button. The error carries the fix in both directions: add `writes`, or drop
`editable`.

**No `views.form`.** A form's field order is the resource's own `fields` order,
and the runtime owns everything else about how it is drawn. `views.detail` has
sections because a detail view shows every field and needs grouping; a form
shows the opt-in subset, which is small by construction. Arrangement can be
added additively if 027 proves it is needed, and #012's reversibility is the
reason it is cheap to wait.

**Nothing is coerced, anywhere.** A value is the type its field declares or the
write is refused. `"false"` is not false, `""` is not null, `1` is not true.
The one apparent exception is not one: a `number` field accepts the digits of a
number as a string, bound exactly as sent, because that is what the reader
answers a `numeric` or `bigint` with when it cannot be a JSON number without
losing digits — refusing it would make a value readable and unwritable.

056 · 2026-08 · A form's write is one statement: the insert or update runs
inside a data-modifying CTE and the record it returns is selected out of it,
through the same select list, the same relation joins and the same mapper a
detail read uses. So a written record and a read one are the same shape, and
"a sensitive field is never selected" keeps having exactly one door
(`columns.ts`). The RETURNING list is derived from the same select entries as
the outer query, so the two cannot drift; sensitive columns are named in
neither.

**One statement rather than a write and then a read.** There is no moment
between them for somebody else's write to land in, and no transaction to hold
open across two round trips on a pool that only lends out `query`.

**Refusals carry a path and a hint, including the engine's own.** The
submission is checked against the definition before the statement is built and
the fields are checked again where it is built — two walls, sharing one
predicate so they cannot disagree about the reason. Both answer in #008's error
shape with a path of `values.<field key>`, which is what a form puts under the
input it belongs to. A definition stored before a rule existed is exactly what
the second wall is for.

**Last-write-wins, stated rather than solved.** An update writes the fields it
names over whatever is there; nothing carries a version and nothing is compared
before writing. It is in SCHEMA.md's known limitations because it is a real
property of the product, and the answer for a record that cannot afford it is
an endpoint that can decide.

057 · 2026-08 · A form is a screen with an address, and it exists only where
the definition says it may. `r/:resource/new` and `r/:resource/:id/edit` are
routes rather than a dialog over the screen behind them: a form can be linked
to, gone back from and reloaded into, which is the rule #033's table filters,
§9's record tabs and §11's console pages all keep. Why: a person filling a form
in is *somewhere*, and a modal is the one surface in this product that cannot
say where.

**The opt-in is checked at the screen, not only at the buttons.** `New` is on
the table header where `writes.create` is declared and `Edit` on the record
header where `writes.update` is, and the form screen itself refuses a resource
that declares neither — so an address typed by hand is answered the way any
other address this admin has no screen for is. The two flags are read
separately all the way down: a resource that takes corrections is not thereby
one records can be typed into (#055).

**`primary` marks the button that goes ahead, never the one that navigates.**
The entry points are `outline`, like every other control on their screens; the
submit is the fill, which is the same rule §10 already keeps for the dialog —
one thing to go ahead with, one fill. `Edit` sits at the head of the action row
and stays there: an action comes and goes with the record's state (#038), and a
control that moves under the pointer is worse than one that is always in the
same place.

**An enum's tone is ink, not a fill.** A `<select>` the height of a form row
wearing a badge's tint is a coloured block on a data panel, which is what the
notice stopped being (#052) and for the same reason. The value's own word is
still the first signal and the colour the second, and a value the definition's
`tones` map leaves out is quiet — the runtime reads severity out of the
definition or out of nothing (#029).

**The em-dash is how a form says nothing, and it belongs to a record that
exists.** A nullable field holding `null` draws the mark the record page draws
for the same fact, and pressing it puts the input there; a trailing em-dash puts
it back. That is the only way to tell a field that is empty from one holding an
empty string, which the write path keeps apart on purpose. It is off on a record
being *made*: every field of a new record is unanswered, an unanswered field is
left out of the write so the column's own default stands, and a form that made
an operator press a dash before typing into each optional box would be charging
for a distinction that does not exist yet. An empty box means what the type
allows — `""` for `text`, `longText`, `email` and `url`, which have one, and
nothing for the types that do not.

**A refusal is placed by its path and by nothing else.** `values.<field key>`
puts the sentence under that input and marks it `aria-invalid`; `values`, or a
path this screen has no input for, is shown at the form. The words are the ones
written upstream (#056) and the runtime rewrites none of them. The same
predicate the engine runs (`checkRecordValues`) runs beside the inputs first, so
an operator is told before a round trip rather than after one — it is not a
second opinion, and the engine checks again and decides.

**A failed write is said at the form; a successful one is said in the notice
stack.** The form is still on the screen when a write fails, so the account of
the failure stays with it — a notice would float over the button the operator is
about to press again and then take the only account of it away on a clock. A
success takes the form off the screen, which is exactly the case #050 says a
notice is for.

**Timestamps are written in the clock they are read in.** Every moment in this
admin is shown in UTC (#030), so the digits typed into a `datetime-local` are
UTC digits and are written with `Z`. A `timestamptz` column keeps exactly them
and a `timestamp` column drops the marker and keeps exactly them; neither is
shifted by the offset of whichever machine the form was filled in on.

058 · 2026-08 · Customer-repo minimalism, ruled as law: RePanel may
require code in a customer's repository only when it MUST be theirs by
nature — business rules (#010), secret/credential custody (#023/#013),
or the declaration of intent itself (repanel/, #012). Convenience is
never sufficient cause: agent-authored code is cheap to generate and
fully owned by the customer forever (maintenance, review, audit).
Gate for any proposal: "could RePanel do this as a battery instead?" —
if yes, it's a battery (the runtime-accretion advantage exists precisely
so improvements land for every customer with zero repo diffs). Applies
with extra force to recipes: each recipe's customer-side surface is
measured in lines and minimized as a design goal.

059 · 2026-08 · Where a primary key comes from is declared intent, and
`database` is what a resource says by saying nothing: the engine leaves the key
column out of the insert, the column's own default generates, and `RETURNING`
reports what it issued. A key the client supplies is the explicit exception —
`primaryKeyGeneration: "client"` opens the `primaryKey` field for writing, and
the create form asks for it. Why: before this, the primary key was refused
outright, which quietly ruled out every table whose key is a slug, an
externally-issued number, or an id the application mints — those resources could
offer `update` and never `create`, and nothing in the definition could say why.

**The definition never states a generation algorithm.** It says who decides the
key and stops there. Whether the default behind a `database` key is a sequence,
a `gen_random_uuid()`, or a trigger is the customer's schema's business; RePanel
naming it would be RePanel guessing at a column it has never read, and getting
it wrong would mean writing a key over one the database was going to issue.

**A key is written once, or not at all.** An update refuses the `primaryKey`
under either value, because a key addresses the record rather than describing it
— it is in the URL of the very form that would change it (#055). So the control
exists on the create form and on no other, and the same predicate that decides
the statement decides which controls are drawn (#056).

**Refused at both layers, like every other write rule.** A key in a create
payload for a database-generated resource is stopped by the value check and
again where the statement is assembled, with a path and a hint (#008) rather
than a bare failure — a definition stored before this existed is served
unchanged, and the second wall is what stands between it and a write.

**Declared where it means something.** `primaryKeyGeneration` on a resource that
creates no records is a validation error rather than a harmless extra: it is an
author who believes they opened something, and silence would be the only answer
they got.
