# Task 028 · Audit log

## Context
"Who did what, when" — the trust battery (research: non-negotiable for
teams). Server-side "execution truth" makes it nearly free: every write
already flows through two choke points (actions, form writes).

## Scope
- api: `audit_events` table — actor (user id + email snapshot), project,
  resource key, record pk, kind (action | create | update), action key
  where applicable, BEFORE/AFTER field values for writes (sensitive
  fields NEVER captured — assert by test, #016), outcome (ok | refused |
  failed category), timestamp. Written in the same transaction as
  dbUpdate/form writes; best-effort-after for httpCall (record the
  attempt + outcome).
- Runtime UI: a record's detail gains an Activity related-list (its own
  events, newest first); console gains nothing yet (operator-facing
  first; console-wide audit browse is post-MVP).
- Retention: none in v1 (append-only); note it.

## Out of scope (binding)
Read auditing, console browse/export UI, retention policies, SIEM
export, IP/user-agent capture.

## Acceptance
- [ ] Approve on Crewbase produces an event with outcome; the 409 path
      records refused; a form edit records before/after minus sensitive
- [ ] The transaction property holds: failed write = no event claiming
      success (test)
- [ ] Activity renders in the design system (screenshot)

## Allowed dependencies
None new.
