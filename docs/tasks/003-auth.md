# Task 003 · Authentication (users + sessions)

## Context
First real feature and first migration. RePanel control-plane users sign in
with email/password; sessions are DB-backed with an httpOnly cookie. Roles,
workspaces, password reset are all later. Follows the CLAUDE.md feature
layering exactly — this module is the reference implementation for every
feature after it.

## Scope
- Tables (drizzle, in `src/db/schema/`): `users` (id uuid pk default random,
  email citext/lowercased unique, password_hash, name, created_at) and
  `sessions` (id uuid pk, user_id fk cascade, token_hash unique, expires_at,
  created_at). Generate the first migration.
- `auth/` feature module per CLAUDE.md layering:
  - `POST /auth/signup` (open signup for POC), `POST /auth/login`,
    `POST /auth/logout`, `GET /auth/me`.
  - Passwords: bcrypt, cost 12. Sessions: 256-bit random token, stored
    hashed (sha256), cookie `repanel_session` httpOnly, sameSite=lax,
    secure in production, 30-day expiry, sliding not required.
  - `SessionAuthGuard` + `@CurrentUser()` decorator in the auth module,
    exported for other features.
  - Wrong credentials → generic 401 (never reveal which part failed).
    Duplicate email → ConflictError.
- Request DTOs (zod) in `packages/contracts` under `src/auth/`; response
  types plain. Wire the global zod validation pipe in `main.ts` now (it was
  deferred in 002).
- Mapper: user entity → `UserDto` (id, email, name). password_hash never
  crosses the boundary — asserted by a test.

## Out of scope (binding)
Password reset, email verification, OAuth, roles/permissions, workspaces,
rate limiting, account deletion, remember-me variants, CSRF middleware.

## Acceptance
- [ ] Service specs: signup happy path, duplicate email, login wrong
      password (generic error), me with valid/expired session
- [ ] A test asserts UserDto contains no password_hash
- [ ] Migration applies cleanly to a fresh DB
- [ ] Cookie flags exactly as specified

## Allowed dependencies
`bcrypt` + `@types/bcrypt`, `cookie-parser` + `@types/cookie-parser`. Nothing else.
