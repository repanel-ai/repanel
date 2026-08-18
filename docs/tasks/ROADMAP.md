# POC Roadmap — tasks 003–014

Place in docs/tasks/. Run in order. The prompt for every task is identical:

> Read CLAUDE.md fully, then implement docs/tasks/NNN-name.md exactly.
> The out-of-scope list is binding. [If the task has a PLAN GATE: post your
> plan and wait for approval before writing code.] After implementation run
> pnpm -r build && pnpm -r typecheck && pnpm -r test, give your summary per
> the definition of done, and stop.

| # | Task | Gate | Notes |
|---|------|------|-------|
| 003 | Auth (users, sessions) | — | first real tables + migration |
| 004 | Projects | — | |
| 005 | Definitions (draft storage + validation) | — | |
| 006 | MCP server | PLAN GATE | tool names/shapes are public contract |
| 007 | Connections (encrypted customer DSN) | — | |
| 008 | Query engine + runtime data API | PLAN GATE | safety-critical SQL |
| 009 | Web foundation | — | |
| 010 | Runtime shell + tables | PLAN GATE | design plan reviewed before code |
| 011 | Detail pages | — | |
| 012 | Actions (dbUpdate + signed httpCall) | — | |
| 013 | SkyScout reference app + authoring guide | — | |
| 014 | Control plane (minimal) | — | |

## Checkpoints — stop and report to the CTO

- **A — after 004:** api boots, login works, project creatable via curl.
- **B — after 006:** connect a real coding agent to /mcp and round-trip a
  definition (submit → errors → fix → valid). This is the first live test of
  the product loop; send the transcript.
- **C — after 010:** screenshots of the rendered table view, light + dark.
  Visual quality is the wedge — this gets a real review before 011 proceeds.
- **D — after 013:** run the acceptance scenario (SCOPE.md) with a fresh
  coding agent against SkyScout; send the generated definition + screenshots.

Between checkpoints, run tasks back-to-back. Send each task's completion
summary regardless; only the checkpoints require waiting for a reply.

## Decision to append to docs/DECISIONS.md before starting 008

014 · 2026-08 · Runtime query safety: the query engine executes only
definition-derived queries. Table/column identifiers come exclusively from a
validated definition (quoted, allowlisted); user input enters only as bound
parameters; sensitive fields are never selected; every query carries a
statement timeout and a hard row limit. A query shape the definition cannot
express does not run. Why: the customer DB connection is the most dangerous
thing we hold; safety by construction, not by review.
