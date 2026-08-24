# Task 025 · Publishing & snapshots — PLAN GATE

## Context
The availability fix the exam transcript proved we need (roadmap
decision c): today an invalid resubmit takes a live admin down. Split
draft from published: agents submit drafts freely; the runtime serves
the published snapshot; a human (or an explicit flag) promotes.

PLAN GATE: post (1) the data model (immutable snapshots vs mutable
draft; what "publish" copies), (2) the MCP surface change — additive
only: does submit gain a publish flag, or does a publish_definition tool
appear? — with tool descriptions, (3) console UX (Definition page gains
draft-vs-published states + a publish action), (4) runtime resolution
order and what "no published version" renders, (5) migration for
existing projects (current valid draft becomes published v1). Wait.

## Scope
Implement the approved plan across contracts (only if a wire shape needs
it), api (definitions model + endpoints + MCP), console (Definition
page), runtime (serve published). Preserve: invalid drafts stored with
errors (#020's promise), the update loop's ergonomics (an agent's happy
path stays one submit; publishing may default-on via a documented flag
for solo use so the loop doesn't grow a mandatory ceremony).

## Out of scope (binding)
Version history UI beyond current+previous, rollback UI (keep the data
able to express it), environments/promotion, scheduled publishing.

## Acceptance
- [ ] The exam scenario neutralized: submit an invalid draft over a
      published admin → admin keeps serving; console shows the failing
      draft's errors; fix + publish → new version live
- [ ] Existing projects migrate without operator-visible change
- [ ] MCP change is additive; old clients keep working (spec proves it)

## Allowed dependencies
None new.
