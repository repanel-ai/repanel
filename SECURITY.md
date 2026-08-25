# Security policy

RePanel renders an admin interface over a customer's production database. A
vulnerability here is a vulnerability in someone else's data, so we would much
rather hear about it early and awkwardly than late and politely.

## Reporting a vulnerability

**Do not open a public issue.**

Report privately through GitHub: **[Security → Report a
vulnerability](https://github.com/repanel-ai/repanel/security/advisories/new)**.
That channel is private between you and the maintainers, and it is the one we
watch. If you cannot use it, email **security@repanel.dev**.

Useful things to include, in rough order of usefulness: what an attacker gets,
the smallest reproduction you have, the commit or version you tested, and
whether it needs an existing account or a hosted deployment.

What to expect:

| | |
|---|---|
| We acknowledge | within 3 business days |
| We come back with an assessment | within 10 business days |
| We fix and disclose | coordinated with you; credit unless you'd rather not |

RePanel is pre-1.0 and in public preview. Fixes land on `main`; there are no
maintained release branches to backport to yet.

## What is in scope

Anything that breaks one of the guarantees the product is built on:

- **The query engine** (`packages/engine`) executing anything other than what a
  validated definition permits — identifier injection, a value reaching SQL
  unbound, a query escaping its statement timeout or its schema.
- **The definition validator** (`packages/contracts/src/definition/`) accepting
  a definition it should refuse, especially one that reaches a field marked
  `sensitive` or `hidden` through columns, search, filters, sorting or an action
  URL.
- **Customer connection strings.** The DSN is encrypted at rest, never returned
  to a client, and never passes through an authoring agent. Any path that
  exposes one, in an API response, a log line, an error message or a process
  argument.
- **Action signing** (`docs/SIGNING.md`). Forging a signature, replaying a
  captured request past its tolerance, or getting an `httpCall` to reach an
  address the definition does not declare.
- **Authentication and session handling**, including MCP token scoping — a
  token reaching a project it was not issued for.
- **`repanel dev`'s egress guarantee.** The CLI makes no call off your machine
  except the database you confirm and the endpoints your own actions declare.
  Any outbound connection beyond those two is a bug of this kind.
- **Cross-tenant reads or writes** anywhere in the control plane.

## What is out of scope

- **`examples/crewbase`.** It is a deliberately trap-laden reference
  application — an exposed password hash and a soft-delete that a naive admin
  shows are *the point* of it, not findings. Its `README.md` lists them.
- Findings that require an already-compromised host, database or operator account.
- Volumetric denial of service, and expensive queries an operator can already
  run against their own database by hand.
- Missing hardening headers or TLS configuration on a deployment you control.
  Self-hosting is yours to operate.
- Reports from automated scanners with no demonstrated impact.

## Design and residual risk

RePanel's threat model is published rather than implied:
**[`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md)** states the assets, the trust
boundaries, what each component can and cannot do, and — plainly — the risks
that remain. The action signing scheme, which you can verify against your own
application, is **[`docs/SIGNING.md`](docs/SIGNING.md)**.

If your finding contradicts something asserted in either document, say so; a
wrong claim in the threat model is itself a defect worth reporting.

Self-hosting is one of the answers the threat model gives, so the licence that
makes it possible is part of the same conversation:
**[`docs/LICENSING.md`](docs/LICENSING.md)** explains the per-package split in
plain language.
