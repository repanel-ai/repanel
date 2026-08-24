# Task 018 · CLI package + multi-file assembler

## Context
The CLI is the MVP's front door (`repanel dev|link|deploy`). This task
builds the package and its foundation: the assembler that turns the repo
convention (#0NN multi-file layout) into the single submitted object.

## Scope
- `packages/cli` (`@repanel/cli`, bin `repanel`): ESM Node CLI, minimal
  deps, command skeleton with `--help` for dev/link/deploy (dev/link/
  deploy themselves are 019/020 — here they print "coming next" stubs).
- The assembler, as a library + `repanel validate` command:
  - reads `repanel/definition.json` (degenerate case) OR
    `repanel/app.json` + `repanel/resources/*.json`; filename must equal
    the resource key (mismatch = error naming both).
  - deterministic composition order (navigation order, then sorted keys
    for unlisted resources) so validation paths are stable.
  - runs the contracts validator locally; errors printed with path +
    hint AND the source filename prefix (multi-file's promise).
- Crewbase becomes the assembler's fixture: `repanel validate` inside
  examples/crewbase passes.

## Out of scope (binding)
dev/link/deploy implementations, any network call, publishing, npm
publish config polish (021 owns release hygiene).

## Acceptance
- [ ] `repanel validate` in examples/crewbase: valid, zero errors
- [ ] A seeded error in resources/airlines.json reports with the
      filename and the in-file path
- [ ] Single-file and multi-file layouts both assemble; both covered by
      tests, including the filename-mismatch error

## Allowed dependencies
A minimal argument parser (propose one at most) — otherwise none new.
