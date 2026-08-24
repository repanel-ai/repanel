# Task 029 · Operator accounts + minimal roles — PLAN GATE

## Context
The moment a second person logs in (#026's tripwire, research's RBAC
floor): the founder invites an operator who uses the ADMIN but never
the console. Minimal, not a permission system.

PLAN GATE: post (1) the model — per-project membership with role
`owner` | `operator`; operators authenticate with the same session auth
but are authorized only for runtime routes of their projects; owners
keep everything, (2) the invite flow (email-less v1: owner creates an
operator login + shows a one-time password? or invite links? propose the
simplest honest thing), (3) console surface (Agents page sibling:
"People" — list, add operator, revoke), (4) how the runtime's
requireOwned becomes requireMember(role) everywhere, with the test
matrix. Wait for approval.

## Scope
Implement approved plan. Runtime UX for operators: same admin, no
console links they can't use (the sign-in redirect gains a project-aware
landing). Audit events carry the actor (028 integration).

## Out of scope (binding)
Per-resource permissions, per-action permissions, teams/workspaces,
SSO/OAuth, email delivery (v1 may be link/credential based), operator
self-signup.

## Acceptance
- [ ] Matrix test: operator can use the admin (reads, actions, forms per
      definition) and CANNOT reach console endpoints, token minting,
      connection, or another project's runtime
- [ ] Full manual loop: create operator, sign in as them, run an action;
      audit shows their identity (screenshots)
- [ ] Revocation kills the session's access

## Allowed dependencies
None new.
