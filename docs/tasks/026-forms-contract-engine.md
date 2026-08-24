# Task 026 · Forms I: contract + engine writes — PLAN GATE

## Context
The daily-driver battery (#007's deferral ends; research: table stakes).
Per #007, writes are OPT-IN per resource and conservative by default.
This task is the contract and the write path; 027 is the UI.

PLAN GATE: post (1) the schema shape — additive: per-field `editable`
and/or a `views.form` concept, create vs edit capability flags on the
resource, required/nullable handling, which field types are writable in
v1 (propose: text, longText, number, boolean, date, dateTime, email,
url, enum; relation-set by id; json EXCLUDED v1) — with referential
rules (sensitive never editable #016/#032; readOnly resources refuse;
primaryKey never; visibleWhen interplay none), (2) the engine write
path: parameterized INSERT/UPDATE built under #014/#024 rules
(identifiers from definition only, values bound, RETURNING the row),
server-side type validation errors in the #008 shape, (3) the runtime
API endpoints + their authorization. Wait for approval.

## Scope
Implement approved plan: contracts (+SCHEMA.md, fixtures incl. Crewbase
gaining one editable resource), engine (write builder + tests at #024's
adversarial standard — this is the highest-risk SQL since 008; mutation-
test the guards), api endpoints, AUTHORING.md teaching opt-in philosophy
("editable is a decision, not a default; when in doubt, an action or an
endpoint").

## Out of scope (binding)
The UI (027), file/image fields, json editing, bulk edit, delete
(create+update only in v1 — deletion is a rule-bearing act that belongs
in endpoints until audit exists), optimistic concurrency (flag the
last-write-wins reality in SCHEMA.md known limitations).

## Acceptance
- [ ] Adversarial suite: hostile identifiers impossible, sensitive/
      readOnly/pk writes refused at BOTH validation and engine layers,
      type coercion honest, RETURNING mapped
- [ ] Crewbase: one resource editable end-to-end via curl
- [ ] Every refusal produces a path+hint error

## Allowed dependencies
None new.
