# Task 031 · The connector — PLAN GATE

## Context
Trust-ladder rung 3 (standing decisions): one open-source binary beside
the database, holding the DSN locally, dialing OUT; Cloud sends
definition-derived descriptors, never SQL — #014 extended across the
network. The wire protocol IS the existing runtime request contract
(the addendum's law: no connector-only query path, ever).

PLAN GATE: post (1) transport (outbound WebSocket: auth via a connector
token minted per project, heartbeat, reconnect, request/response
correlation), (2) the descriptor frames — reusing contracts'
listRecordsQuerySchema + record/related/action addressing verbatim,
with the version-skew rule (connector states its contracts version;
mismatch = refuse loudly), (3) Cloud-side routing (connection kind:
'postgres-direct' | 'connector'; the api's engine adapters route by
kind; timeouts across the hop), (4) definition sync (connector pulls the
published definition over its channel on connect and on publish),
(5) packaging (`repanel connect --token ...` — lives in the CLI or its
own bin, propose). Wait for approval.

## Scope
Implement approved plan: the connector embedding @repanel/engine +
@repanel/contracts, api routing, console Connection page gains the
connector option (mint connector token, show the run command, live
connected/last-seen status), docs (THREAT-MODEL.md's residual-risk
section updated: the structural answer now exists).

## Out of scope (binding)
VPC/enterprise packaging (containers/helm), multi-connector HA, any new
query capability, MySQL, replacing direct-DSN (it remains the default
onboarding rung per the trust-ladder amendment).

## Acceptance
- [ ] End-to-end: Crewbase's DB reachable ONLY via a running connector
      (direct DSN removed) — full admin works: reads, relations,
      actions, forms
- [ ] Kill the connector → runtime errors sanitized ("connector
      offline" category); restart → recovers without operator action
- [ ] Contract-version skew test refuses cleanly
- [ ] Grep gate: no SQL string crosses the wire (assert on frame types)

## Allowed dependencies
`ws` (or propose); nothing else.
