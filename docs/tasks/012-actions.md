# Task 012 · Actions (dbUpdate + signed httpCall)

## Context
Actions make the admin operational. Two kinds only (schema v0): a guarded
single-field dbUpdate, and an httpCall to a customer endpoint signed per
DECISIONS #013. The httpCall path is the proof that business logic stays in
the customer app.

## Scope
### API (`runtime/` module or a sibling `actions/` module — agent's call,
justify in summary)
- `POST /runtime/:projectKey/resources/:resourceKey/records/:id/actions/:actionKey`
  (session auth, owner).
- dbUpdate: parameterized `UPDATE <table> SET <field> = $1 WHERE <pk> = $2`
  through the customer pool — identifiers from the definition only (decision
  014 applies here fully); affected-rows 0 → NotFoundError.
- httpCall:
  - URL template resolved with the record's CURRENT field values (fetched
    server-side, never trusted from the client), values URL-encoded;
    template referencing a sensitive field → refuse with a validation error
    (also add this as a referential check in contracts if not present).
  - Signing: per-project `action_secret` (generated on first use, stored
    encrypted via CryptoService). Headers: `Repanel-Timestamp` (unix
    seconds), `Repanel-Signature: v1=<hex hmac-sha256(secret,
    "<timestamp>.<METHOD> <url>")>`. Document the scheme in
    docs/SIGNING.md with a verification snippet (Node) — this doc is what
    per-stack guides will reference.
  - 10s timeout; 2xx → success (definition's success semantics: return the
    action's label + ok), non-2xx/timeout/network → sanitized failure
    category; customer response bodies are never forwarded to the browser.
- Endpoint to reveal the action secret to the owner:
  `GET /projects/:id/action-secret` (session auth) — needed to configure the
  customer app; plaintext returned only here.

### Web
- Detail page: actions rendered from the definition (header menu or buttons
  per the 010 design plan), confirmation dialog showing the definition's
  confirm text, pending state, success/error toasts, record query
  invalidated on success (status badge updates immediately).

## Out of scope (binding)
Bulk actions, action inputs/bodies, retries, idempotency keys, audit log,
webhook-style async callbacks, secret rotation, table-row actions (detail
page only for POC).

## Acceptance
- [ ] dbUpdate specs: happy path, 0-rows → NotFound, enum value guaranteed
      by validation (test referencing the contracts check)
- [ ] httpCall specs: signature matches an independent HMAC computation;
      template resolution + encoding; sensitive-field template refused;
      timeout and non-2xx produce sanitized categories
- [ ] Web specs: confirm-dialog flow, invalidation on success
- [ ] SIGNING.md verification snippet actually verifies a captured request
      (self-test in specs)

## Allowed dependencies
None new (undici/fetch built-in).
