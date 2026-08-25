# Contributing to RePanel

RePanel is an admin runtime: a coding agent inspects an application and submits
a structured *definition*; RePanel renders it as a polished admin interface. The
customer owns the definition, RePanel owns the runtime. `docs/VISION.md` and
`docs/SCOPE.md` are the long form.

Contributions are welcome. This page is how the work actually runs here — not an
aspiration, and not a different process from the one the maintainers use.

## How this repository is built

Three documents govern every change, and they are worth reading before the code.

**`CLAUDE.md` is the standing rulebook.** It fixes the stack, the backend and
frontend layering, the anti-overengineering rules, the testing bar and the
commit format. It is not advisory. A change that ignores it will be asked to
change, however good it is otherwise — "use the framework", "build only what the
task asks", and "no dumping grounds" are the three it most often comes down to.

**`docs/tasks/` holds the work.** One task = one file = one PR-sized change.
Each task states its context, its scope, an **out-of-scope list that is
binding**, checkable acceptance criteria, and the dependencies it is allowed to
add. If a task looks like it is missing something, that is a question to raise,
not a gap to fill. `docs/tasks/README.md` describes the shape;
`docs/tasks/ROADMAP-MVP.md` is what is planned.

**`docs/DECISIONS.md` is append-only.** It records what was decided and *why*,
numbered, with the reasoning that would otherwise be lost. Reversing a decision
is a **new entry**, never an edit to the old one — the old reasoning is the
point. Etiquette:

- A change that settles something non-obvious earns an entry. Most changes do not.
- Write the *why*. An entry that only restates the diff is noise.
- Do not renumber, do not reflow, do not tidy old entries.
- Propose the entry in your PR description; a maintainer appends it.

## Running everything

**You need** Node ≥ 22 (24 is what CI runs), pnpm 9, and Docker for the two
Postgres instances.

```bash
git clone https://github.com/repanel-ai/repanel.git
cd repanel
pnpm install
pnpm -r build
```

Everything below assumes that install and build have run.

### The checks

These three are what CI runs, and what a PR is expected to pass:

```bash
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

`pnpm -r test` alone leaves one suite **skipped**, and it will tell you so:
`apps/api`'s query-engine integration suite runs only when it is given a
database, because what it asserts — identifier folding, the types the driver
returns, the statement timeout — cannot be asserted against a stub. Give it one
and it runs:

```bash
docker compose up -d    # postgres on 5432
TEST_CUSTOMER_DATABASE_URL=postgres://repanel:repanel@localhost:5432/repanel \
  pnpm --filter @repanel/api test
```

The suite creates a schema of its own, fills it, and drops it; it does not
disturb anything else in that database. **CI always sets this variable**, and
fails if any suite is skipped — a test that silently does not run is a test that
does not exist.

### RePanel itself

Three surfaces on three origins, plus its own database:

```bash
docker compose up -d                        # postgres on 5432
cp apps/api/.env.example apps/api/.env
openssl rand -base64 32                     # paste into APP_ENCRYPTION_KEY
pnpm --filter @repanel/api db:migrate
pnpm dev:api                                # http://localhost:3001
pnpm dev:web                                # http://localhost:5173  the console
pnpm dev:runtime                            # http://localhost:5174  the admin
```

`APP_ENCRYPTION_KEY` is the only value you must generate. It encrypts customer
connection strings at rest, so the API refuses to boot without a real one.

### The local loop: Crewbase and `repanel dev`

`examples/crewbase` is the reference customer application — a small aviation
staffing marketplace that exists to be administered, with a database full of the
cases an admin gets wrong (a password hash, a soft delete, a status with a rule
behind it). Its `README.md` explains each one.

This is the loop most contributions should be exercised against:

```bash
cp examples/crewbase/.env.example examples/crewbase/.env
docker compose -f examples/crewbase/docker-compose.yml up -d   # postgres on 5433
pnpm --filter crewbase db:push
pnpm --filter crewbase seed                # ~200 deterministic rows
pnpm --filter crewbase dev                 # http://localhost:3002

pnpm --filter crewbase exec repanel dev    # http://127.0.0.1:5170/a/local/
```

`repanel dev` serves the real admin against Crewbase's own database, with no
RePanel account and no RePanel network call. It reads the definition out of
`examples/crewbase/repanel/`, picks up your edits as you make them, and shows a
definition that does not validate as an overlay over the last one that did. Edit
a file under `repanel/resources/`, save, and watch the admin change.

It prints a `REPANEL_ACTION_SECRET` on startup. Put that value in
`examples/crewbase/.env` and restart `pnpm --filter crewbase dev` if you want
the `approve` action to work — Crewbase verifies the signature on every call
RePanel makes to it (`docs/SIGNING.md`), so a mismatched secret correctly comes
back as a refusal.

The CLI's own suite, and the rest:

```bash
pnpm --filter @repanel/cli test
pnpm --filter @repanel/cli exec repanel --help
```

## Making a change

### Sign your commits off (DCO, not a CLA)

RePanel takes contributions under the [Developer Certificate of
Origin](DEVELOPER_CERTIFICATE) 1.1. There is no CLA and no copyright assignment:
you keep your copyright, and you certify that you have the right to contribute
what you are contributing.

Every commit in a pull request must carry a `Signed-off-by` line matching the
commit author. `git commit -s` adds it:

```
Signed-off-by: Your Name <you@example.com>
```

CI checks this on every pull request. If you forget, `git rebase --signoff
origin/main` fixes the whole branch.

### Licensing of what you contribute

Your contribution is licensed under the license of the package it touches.
RePanel is multi-licensed by package — MIT, Apache-2.0 and AGPL-3.0 all live
here — and [`LICENSES.md`](LICENSES.md) is the map. Check which one you are
working in before you start; moving code between packages can move it between
licenses, which is a thing to raise in the PR rather than do quietly.

**RePanel does not use per-file SPDX headers, and please do not add them.** The
authority for a file's license is the `LICENSE` in its package plus the
`license` field in that package's `package.json` — two places that a scanner and
a human both already read, and that cannot drift from each other the way
thousands of copied header comments can. New *packages* need both; new *files*
need neither.

### Commits

Conventional Commits v1.0.0, as `CLAUDE.md` specifies: `feat:`, `fix:`,
`build:`, `chore:`, `ci:`, `docs:`, `perf:`, `refactor:`, `style:`, `test:`,
with an optional noun scope (`fix(engine):`). One short lowercase imperative
line, no trailing period. A body only when the change cannot be understood
without one. Breaking changes take `!` before the colon or a `BREAKING CHANGE:`
footer.

Do not add `Co-Authored-By` trailers. `Signed-off-by` is required.

### Tests

Test behavior, not mocks: assert returned values, persisted state, thrown domain
errors. New logic needs tests **including at least one error path**. Services,
mappers and the definition validator get thorough coverage; controllers and
presentational components get light coverage. Tests are co-located with what
they test, and test output must be clean — no stray console noise.

### Before you open a pull request

- [ ] `pnpm -r build`, `pnpm -r typecheck` and `pnpm -r test` pass from the root
- [ ] The integration suite ran (see above) rather than skipping
- [ ] New logic has tests, one of them an error path
- [ ] No new dependencies beyond what the task allows — propose, don't install
- [ ] Commits are signed off and conventionally formatted
- [ ] Any decision worth recording is proposed in the PR description

## A note on scope

Two kinds of change are routinely turned down, and it is fairer to say so here
than in review:

**Additions to `packages/contracts/src/definition/`.** The definition schema is
a public product contract. Every customer's definition is written against it, so
changes are additive, versioned, and never casual — and the schema deliberately
contains no branching, sequencing or computation (decision #010). Multi-step
logic belongs in the customer's own application, reached by an `httpCall`
action. Open an issue first.

**Abstractions for futures that have not arrived.** No speculative parameters,
no configuration for hypothetical deployments, no `utils/` folder. YAGNI is
policy here, not preference.

## Security

Do not open a public issue for a vulnerability. [`SECURITY.md`](SECURITY.md) has
the private channel.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
