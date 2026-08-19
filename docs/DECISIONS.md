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
