# Task 023 · Skill packaging

## Context
#021's layer 2 ships: AUTHORING.md's content as an installable skill —
the distribution channel for the vibe-coder segment (#034). One source
tree, no drifting copies.

## Scope
- `skills/repanel/` in-repo: SKILL.md front-matter + body GENERATED from
  docs/AUTHORING.md sections by a small build script (single source; CI
  fails if regeneration drifts from the committed artifact).
- Skill structure: trigger description (when an agent should load it),
  the workflow (inspect → schema docs → author → submit → repair; the
  local file loop from 019; the link/deploy offer from 020), field
  classification, endpoint preference AND the consent-gated "offer to
  write the missing endpoint" flow (checkpoint D's banked finding),
  platform sections (Supabase), multi-file convention.
- Install path documented for Claude Code (and the generic agents.md
  form): one command/copy, stated in the README plan.
- The floor stays sovereign: MCP descriptions must remain sufficient
  without it — add a line to the mcp module docs asserting that rule.

## Out of scope (binding)
Marketplace submissions (post-launch, needs the public repo), per-stack
guides beyond what AUTHORING.md already has, any MCP surface change.

## Acceptance
- [ ] Skill regenerates byte-identical in CI from AUTHORING.md
- [ ] A fresh Claude Code session with the skill installed, in
      examples/crewbase, follows the local loop unprompted (manual check
      documented with transcript excerpt)

## Allowed dependencies
None (node script).
