# Task 019 · repanel dev — PLAN GATE

## Context
The zero-config local rung (#0NN dev-to-cloud continuity): the full
product, locally, no account. This is the launch demo's engine.

PLAN GATE: post (1) the process model (one local server: engine +
runtime data API + static runtime SPA + watch/validate channel),
(2) how the runtime SPA is served (built asset embedded in the CLI
package vs built on demand) and how its api-client targets the local
server, (3) the error-overlay mechanism, (4) DATABASE_URL inference and
confirmation flow. Wait for approval.

## Scope
- `repanel dev`: finds the definition (assembler), finds DATABASE_URL in
  the app's own .env (asks "use this? [Y/n]"; flag to override), serves
  the real runtime at a local port with the engine executing reads and
  actions against that database. No auth — the operator is you (#0NN).
- Watch mode: definition file edits → reassemble → revalidate → hot
  reload; validation failures render as an in-browser overlay in the
  #008 path/hint format WITHOUT killing the last good render.
- No RePanel account, token, or network call anywhere in the path.
- AUTHORING.md gains the local workflow section: file-based loop, the
  overlay as the agent's feedback channel.

## Out of scope (binding)
link/deploy, publishing, auth, telemetry, MySQL, the connector,
bundler heroics — if serving the SPA cleanly requires build-system work
beyond the plan, STOP and present options.

## Acceptance
- [ ] In examples/crewbase: `repanel dev` → admin renders against the
      seeded DB; edit a resource file → reload; break it → overlay with
      path+hint; fix → recovers
- [ ] Zero network egress verified (state how)
- [ ] Actions execute locally (approve flow works; HMAC signing uses a
      locally-generated dev secret, documented)

## Allowed dependencies
Propose the minimal set at the gate (file watcher, static server).
