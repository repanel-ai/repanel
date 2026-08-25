# The RePanel skill

`repanel/SKILL.md` is [`docs/AUTHORING.md`](../docs/AUTHORING.md) packaged so an
agent can load it on demand: how to read an application into a definition, how
to classify a column, when an action needs an endpoint in the application, and
how to run the admin locally with `repanel dev`.

**It is generated.** The guide is the only copy; `pnpm skill` writes this one
from it, and CI fails if the two have drifted. Edit `docs/AUTHORING.md`.

## Install it — Claude Code

One command, no clone. For every project on this machine:

```bash
mkdir -p ~/.claude/skills/repanel && curl -fsSL \
  https://raw.githubusercontent.com/repanel-ai/repanel/main/skills/repanel/SKILL.md \
  -o ~/.claude/skills/repanel/SKILL.md
```

For one repository, so it arrives with the checkout and your team gets it too,
put the same file at `.claude/skills/repanel/SKILL.md` and commit it.

## Install it — any other agent

Agents that read an `AGENTS.md` take the same file by reference. Copy it into
the repository and name it there:

```bash
mkdir -p .agents && curl -fsSL \
  https://raw.githubusercontent.com/repanel-ai/repanel/main/skills/repanel/SKILL.md \
  -o .agents/repanel.md
```

```markdown
<!-- AGENTS.md -->
When working on the RePanel admin definition in `repanel/`, read
[.agents/repanel.md](.agents/repanel.md) first.
```

The front matter at the top is Claude Code's; every other agent reads past it
as a comment.

## It is never required

RePanel's MCP tool descriptions and server instructions are self-sufficient on
their own: an agent that has never heard of this file can still author a
definition, submit it and repair it. The skill makes that go better — it is the
part that cannot be said in a tool description — but it never gates the work
(DECISIONS #021).
