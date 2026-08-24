# MVP Roadmap — tasks 017–031

Place in docs/tasks/. Same operating system as the POC: one task = one
fresh session = one prompt pointing at the file. Standard prompt:

> Read CLAUDE.md fully, then implement docs/tasks/NNN-name.md exactly.
> The out-of-scope list is binding. [PLAN GATE tasks: post your plan and
> wait for approval before writing code.] Run pnpm -r build &&
> pnpm -r typecheck && pnpm -r test, give your summary per the definition
> of done, and stop.

## Stage 1 — Local-first & the CLI
| # | Task | Gate |
|---|------|------|
| 017 | Engine extraction (packages/engine) | PLAN GATE |
| 018 | CLI package + multi-file assembler | — |
| 019 | repanel dev | PLAN GATE |
| 020 | repanel link + deploy | — |

**Checkpoint E** — the local loop: `npx repanel dev` against Crewbase
with no account (agent edits definition files, watch-revalidate, admin
renders); then `repanel link` + `deploy` promote the same files to Cloud.
Send transcript + screenshots.

## Stage 2 — Launch
| # | Task | Gate |
|---|------|------|
| 021 | OSS hygiene: licenses, DCO, CONTRIBUTING, SECURITY, CI | license map is PLAN-GATED |
| 022 | Threat model + licensing docs | — |
| 023 | Skill packaging (AUTHORING → installable skill) | — |
| 024 | README + 60-second demo assets | — |

**Checkpoint F** — launch readiness: we walk the repo as strangers
(clone → README → repanel dev → wow in under 10 minutes), review the
threat model and license page, then flip the repo public. Launch posture
per the decision below: PUBLIC PREVIEW, honest about read+actions today
with the battery roadmap published.

## Stage 3 — Daily driver (built in public)
| # | Task | Gate |
|---|------|------|
| 025 | Publishing & snapshots (draft/published split) | PLAN GATE |
| 026 | Forms: contract + engine writes | PLAN GATE |
| 027 | Forms: runtime UI | — |
| 028 | Audit log | — |
| 029 | Operator accounts + minimal roles | PLAN GATE |
| 030 | Supabase & pooler compatibility | — |
| 031 | The connector (outbound data plane) | PLAN GATE |

**Checkpoint G** — daily-driver review: forms + audit + roles live on
Crewbase; a second (operator) account uses the admin without console
access; connector run end-to-end against a "remote" database.

## Decisions to append before starting (next free numbers)
(a) MVP plan adopted as above. Launch posture: public preview after
Stage 2 — repanel dev is the front door and the demo moment (#019) is
now; forms/audit/roles land in public with a published roadmap, honestly
labeled, rather than delaying launch by a phase. Research finding
("forms are table stakes") honored by Stage 3's position directly after
launch, not by postponing the launch.
(b) packages/engine becomes the third shared package: the query builder,
customer pool, and definition-serving logic extracted from apps/api —
justified by two independent consumers (repanel dev and the connector),
per the "absolutely shared" criterion that admitted packages/ui. Nothing
else is extracted.
(c) Publishing's availability argument, recorded: in the single-draft
model an invalid resubmit takes a live admin down (checkpoint D
transcript); draft/published split is the fix — drafts validate while
the published snapshot keeps serving.
