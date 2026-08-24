# Task 022 · Threat model + licensing docs

## Context
Security reviewers will find the "lethal trifecta" framing on their own;
we publish our answer first (research recommendation, pre-launch item).

## Scope
- docs/THREAT-MODEL.md, written for a skeptical security engineer:
  - assets & trust boundaries (customer DSN, action secret, agent
    tokens, operator sessions; what each component can and cannot do)
  - the trifecta mapping: private data (read paths under #014/#024
    safety-by-construction — identifiers only from validated
    definitions, bound values, sensitive containment #016/#032),
    untrusted content (admin renders user data; why that cannot become
    instructions to our system), external communication (httpCall: the
    ONLY egress, HMAC-signed, URL templates validated, sensitive fields
    banned from templates) — and the residual risks stated honestly
    (compromised Cloud in direct-DSN mode; mitigations and the connector
    as the structural answer, forward-referenced)
  - secrets-never-transit-the-agent (#0NN) as a design rule with the
    console/CLI side-channels
  - what we ask customers to run and verify (SIGNING.md, self-tested)
- docs/LICENSING.md: the split in plain language, the "can my company
  use this?" table (self-host internal use, hosted-competitor case,
  embedding the MIT contracts), AGPL-ban orgs addressed directly.
- Both linked from SECURITY.md and the README plan.

## Out of scope (binding)
New security features, marketing tone, legal advice claims (plain-
language + "consult counsel" note).

## Acceptance
- [ ] Every claim in THREAT-MODEL.md cites the mechanism (decision
      number or module) that enforces it — no unbacked assertions
- [ ] The residual-risk section exists and names the direct-DSN trust
      assumption plainly
- [ ] LICENSING.md answers the three cases in one screen

## Allowed dependencies
None.
