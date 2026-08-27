# Post-MVP Backlog — the ladder, in one place

Demand-sequenced, not imagination-sequenced. Each item ships only per
#010's gate: can the runtime render it excellently for everyone?
Items graduate to numbered tasks; nothing here is a commitment.

## Runtime batteries
- Bulk actions · CSV export · impersonation (consent + audit) — research-ranked order
- Saved views · column visibility (TanStack Table's reserved trigger, #stack note)
- file/image field type (display first; uploads via customer endpoint + recipe)
- Realtime data (LISTEN/NOTIFY push; polling is the honest current answer)
- Money field type · project display timezone (#030) · resource.icon (#additive)
- source.schema · defaultScope/soft-delete filters (Crewbase findings)
- isSet:false / empty-state visibleWhen (next precondition rung, #038/#042)

## Signals & intelligence (doctrine already ruled)
- Inbound notifications: POST /ingest/:projectKey, customer-signed with the
  action secret (mirror of SIGNING.md), bell in the admin, record deep-links.
  Signals about THIS app to THIS admin's operators — never general
  notification infrastructure. Recipes teach the three-line customer side.
- Aggregate descriptors → resource widgets → endpoint widgets + curated
  recipes (GA, Stripe) → ask-your-data agent → Slack client (#doctrine)

## Platform & scale
- Marketplace/OAuth integrations (Supabase first) · MySQL · per-customer
  theme overrides (#035 mechanism exists) · environments-as-product with
  publishing promotion (#standing decision) · connector enterprise packaging

## 030b · Platform courtesy for Supabase and Neon DSNs
Deferred from #030 by founder ruling: #030 shipped the integrity half —
the per-query timeout is transaction-scoped and proved against pgbouncer
(#063) — and this is the courtesy half, which waits until core
functionality is fully nailed. Nothing here is a correctness gap; the
engine already connects through a transaction pooler.
- DSN recognition: know a Supabase/Neon transaction-pooler host or port
  from a session-pooler one, and an IPv6-only direct connection from an
  unreachable host.
- Steering messages on the connection test: a specific, kind sentence per
  recognized shape, saying where in the dashboard the better string is.
  Categories stay sanitized — no host, user or credential in the answer.
- AUTHORING.md's Supabase section: rewrite the connection guidance around
  what is now true. It currently steers to the session pooler *because*
  RePanel set a session-level `statement_timeout`, and that reason is
  gone. Regenerate the skill with it (`node scripts/build-skill.mjs`).
- Console: the Connection page links that guidance.
