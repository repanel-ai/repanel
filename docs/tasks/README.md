# Task workflow

One task = one file = one agent run = one PR-sized change.

Every task file contains:

1. **Context** — one paragraph + pointers to relevant docs
2. **Scope** — exactly what to build
3. **Out of scope** — binding; the agent must not build these
4. **Acceptance** — checkable criteria
5. **Allowed dependencies** — packages the task may add (nothing else)

The prompt given to the coding agent is always the same shape:

> Read CLAUDE.md, then implement docs/tasks/NNN-name.md exactly.

Completed tasks stay in the folder as history. Tasks are numbered in execution
order. If a task reveals a needed decision, the agent proposes it in its summary;
the human records it in docs/DECISIONS.md. The agent never decides.
