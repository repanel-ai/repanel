# Task 030 · Supabase & pooler compatibility

## Context
The segment's databases are Neon/Supabase behind transaction-mode
poolers (research finding; standing platform doctrine). "Works great in
one paste" needs engine verification + smart DSN guidance.

## Scope
- Engine/pool: verify and fix behavior under transaction-mode pooling —
  per-query statement_timeout must not rely on session state (use the
  transaction-scoped form or SET LOCAL within the query's transaction);
  no session-level prepared statements; document pool sizing guidance.
  Gated integration suite gains a pgbouncer service in CI (021's
  workflow extends) running the read/action paths through it.
- Connection test intelligence: recognize Supabase/Neon DSN shapes —
  transaction-pooler ports/hosts get a specific, kind message steering
  to the session pooler string (with where to find it); IPv6 direct-
  connection failures get their own category. Categories stay sanitized.
- Docs: AUTHORING.md's Supabase section gains the definitive connection
  guidance; console Connection page links it.

## Out of scope (binding)
OAuth/marketplace integrations, RLS impersonation, MySQL, serverless
cold-start mitigation beyond honest timeout messages.

## Acceptance
- [ ] CI proves the engine against pgbouncer transaction mode (suite
      counts asserted)
- [ ] A transaction-pooler DSN in the console yields the steering
      message; a session-pooler DSN connects (manual against a real
      Supabase project, documented)

## Allowed dependencies
CI service images only.
