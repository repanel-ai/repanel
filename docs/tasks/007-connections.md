# Task 007 · Connections (customer PostgreSQL)

## Context
A project stores one customer database connection. The DSN is the most
sensitive secret we hold — encrypted at rest, never returned to any client,
never logged. The pool it opens is consumed by the query engine (008).

## Scope
- Env: add `APP_ENCRYPTION_KEY` (base64, exactly 32 bytes decoded) to the
  env schema; boot fails without it outside NODE_ENV=test.
- `crypto/` infra module: `CryptoService` with `encrypt(plaintext)` /
  `decrypt(payload)` using AES-256-GCM (random 12-byte IV, auth tag stored
  alongside, single versioned string format `v1.<iv>.<tag>.<ciphertext>`
  base64). No other crypto responsibilities.
- Table: `connections` (id uuid pk, project_id fk unique, kind text
  check='postgres', encrypted_dsn, created_at, updated_at). Migration.
- `connections/` feature module:
  - `PUT /projects/:id/connection` (owner) — set/replace the DSN. Response
    contains kind + host + database name parsed for display, NEVER the DSN
    or password.
  - `POST /projects/:id/connection/test` — connect, `select 1`, 5s timeout;
    returns ok or a sanitized failure category (unreachable | auth_failed |
    timeout | unknown) with no raw driver text.
  - `CustomerPoolService` (exported): lazy per-connection `pg` Pool cache
    (max 5 clients, idle timeout 30s, statement_timeout set), invalidated
    when the connection changes, all pools closed on shutdown.
- DSN validation: postgres:// or postgresql:// URL shape via zod in contracts.

## Out of scope (binding)
MySQL, HTTP provider, SSH tunnels, SSL cert options beyond DSN params,
IP allowlists, secret rotation, multiple connections per project.

## Acceptance
- [ ] CryptoService specs: round-trip, tampered ciphertext/tag rejected,
      wrong key rejected
- [ ] Connection specs: DSN never appears in any response DTO (asserted),
      test endpoint returns sanitized categories for each failure mode
- [ ] Pool cache spec: same connection reuses pool; replaced DSN invalidates
- [ ] grep check in summary: DSN/password appears in no log statement

## Allowed dependencies
None new (node:crypto, pg already present).
