# Task 021 · OSS hygiene: licenses, DCO, CONTRIBUTING, SECURITY, CI

## Context
Launch prerequisite. The repo must read as a serious open-source project
to a stranger, and the license split (#019) must be unambiguous enough
that a developer can clear it with their team without a lawyer.

LICENSE MAP IS PLAN-GATED: before writing files, post the per-package
license map under these constraints — contracts: MIT (locked, #019);
apps/api, apps/web, apps/runtime: AGPL-3.0 (locked, #019); goals: cli
maximally permissive (adoption surface), engine protected (runtime
core); flag any dependency-mixing concern (e.g. a permissive cli
depending on an AGPL engine) plainly for founder sign-off rather than
resolving it silently. Wait for approval.

## Scope
- LICENSE files per the approved map (root explains the split), SPDX
  headers policy stated in CONTRIBUTING (not retrofitted into every
  file), package.json license fields.
- DCO (no CLA — #019): DEVELOPER_CERTIFICATE + sign-off requirement in
  CONTRIBUTING; a CI check that commits on PRs carry Signed-off-by.
- CONTRIBUTING.md: the operating system in public form — task files,
  CLAUDE.md as rulebook, decision log etiquette, how to run everything.
- SECURITY.md: private reporting channel, scope, the threat-model link.
- CI (GitHub Actions): build + typecheck + full test suite INCLUDING the
  env-gated integration suites against a service postgres — closing the
  "silently skipped" gap flagged in 012. Badge-ready.

## Out of scope (binding)
npm publishing, changelog automation, issue templates beyond one bug/one
feature form, code of conduct debates (adopt Contributor Covenant
verbatim), the README (024).

## Acceptance
- [ ] CI green on a clean clone, integration suites actually executing
      (assert on their test counts in the workflow)
- [ ] Every package has a license field + file per the approved map
- [ ] CONTRIBUTING accurately describes the real workflow (a stranger
      could run task 018's suite from it)

## Allowed dependencies
None in packages; CI actions as needed.
