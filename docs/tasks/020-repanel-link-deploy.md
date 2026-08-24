# Task 020 · repanel link + deploy

## Context
The one-keypress cloud rungs (#0NN): link marries the repo to a Cloud
project and its database without the secret touching an agent; deploy
pushes the assembled definition.

## Scope
- `repanel link`: browser-based auth (localhost callback against the
  console's session — propose the simplest safe flow in the summary),
  project pick-or-create, then reads DATABASE_URL from the app's env and
  asks: "Connect <host>/<db> to <project>? [Y/n]" — on yes, PUT over the
  authenticated session. Secret path: env → CLI → API, never through any
  model/agent context (#0NN boundary). Writes `.repanel/project` (the
  project key) for deploy; file is committed-safe (no secrets).
- `repanel deploy`: assemble → submit_definition equivalent over the
  user session → print the validation verdict (path+hint on failure)
  and the admin URL on success.
- Agent-invokable by design: both commands are safe for an agent to RUN
  because the confirmation and the secret stay in the terminal/human.
  AUTHORING.md updated to teach agents to offer exactly that.

## Out of scope (binding)
Environments/promotion (projects-as-environments is the answer per the
standing decision; `--project` flag allowed as the only nod), publishing,
token minting via CLI, device-code flows for headless machines.

## Acceptance
- [ ] Full flow live against local Cloud: link (auth → pick project →
      Y → connected), deploy (valid → URL printed), deploy with a seeded
      error (path + hint + source file, exit code nonzero)
- [ ] Grep gate: the DSN value appears in no log, no file, no argv
- [ ] Works from examples/crewbase end to end

## Allowed dependencies
None beyond 018/019's set; propose otherwise.
