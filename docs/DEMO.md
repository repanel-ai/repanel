# Filming the sixty seconds

The launch video is one unbroken claim: **an application with no admin gets a
real one, from a coding agent, in a minute, without an account.** Everything
below is the mechanics of getting that on camera. It is written so that
recording is a matter of following steps rather than making decisions — every
command, every string to type and every frame that has to land is stated.

The loop filmed here is the one checkpoint E performed: `repanel dev` against
[Crewbase](../examples/crewbase/README.md) with no account, the agent writing
the definition files, the admin rendering, an action running through Crewbase's
own endpoint, and then `repanel link` + `repanel deploy` promoting the same
files to a RePanel deployment.

---

## The cast

| | What it is | Where it runs |
|---|---|---|
| **Crewbase** | The customer application. Aviation staffing, ~200 seeded rows, one admin endpoint. | `localhost:3002` |
| **Crewbase's database** | Postgres in Docker. The one RePanel reads. | `localhost:5433` |
| **`repanel dev`** | The whole admin, locally. No account, no RePanel network call. | `127.0.0.1:5170` |
| **Your coding agent** | Writes `repanel/`. Any agent; the film uses whichever you use daily. | your editor |
| **The console + API** | Only for the last eight seconds, where `link` and `deploy` land. | `5173` + `3001` |

---

## Before you press record

### 1 · The machine

- **1440 × 900 capture**, the size every screenshot in this repository is taken
  at. Bigger looks impressive on your monitor and unreadable on a phone.
- **Terminal at 16pt or larger**, dark or light — pick one and keep it for the
  whole film. Prompt cut down to one short segment: no path, no git branch, no
  hostname. `PS1='%F{240}❯%f '` is enough.
- **Browser at 1440 × 900**, no bookmarks bar, no extensions in the toolbar, one
  tab.
- **Notifications off.** Do Not Disturb, and quit the chat apps rather than
  trusting them.
- **The admin's theme is light.** The toggle is in the header if the machine
  woke up dark.

### 2 · The world

From a clean checkout, in this order:

```bash
pnpm install && pnpm -r build && pnpm install

cp examples/crewbase/.env.example examples/crewbase/.env
docker compose -f examples/crewbase/docker-compose.yml up -d
pnpm --filter crewbase db:push
pnpm --filter crewbase seed          # 205 rows: 20 users, 12 airlines, 60 candidates, 28 openings, 85 applications
pnpm --filter crewbase dev           # localhost:3002 — needed for scene 6 only
```

For scene 7, and only scene 7, RePanel itself has to be up
([CONTRIBUTING](../CONTRIBUTING.md#repanel-itself)):

```bash
docker compose up -d                 # RePanel's own postgres, on 5432
pnpm --filter @repanel/api db:migrate
pnpm dev:api                         # 3001
pnpm dev:web                         # 5173 — sign up here once, before recording
pnpm dev:runtime                     # 5174
```

Sign up in the console **before** you record, so the browser is already
authenticated when `repanel link` sends it there. That turns scene 7's browser
round-trip into a flash rather than a form.

### 3 · The starting state

The film opens on an app with no admin, so the definition has to be gone:

```bash
mv examples/crewbase/repanel /tmp/repanel-definition   # scene 2 needs it missing
```

Keep it. Scene 3 puts it back — see *Exact strings* for how the agent does that
on camera, and *Reset between takes* for the shortcut when a take goes wrong.

Check that at least one airline is still `pending`; scene 6 needs one:

```bash
docker exec crewbase-postgres-1 psql -U crewbase -d crewbase \
  -c "select name, approval_status from airlines where approval_status = 'pending'"
```

### 4 · What must never be on screen

- **The `REPANEL_ACTION_SECRET`** printed by `repanel dev`. It dies with that
  process and it is worthless afterwards, so this is not a leak — it is a habit.
  Blur it, or start the recording of scene 4 below that line.
- **Any real credential**, in a shell history, an `.env` in a split pane, or a
  browser autofill dropdown. Use the seeded `@example.com` accounts and nothing
  else.
- Connection strings are already handled: `repanel dev` and `repanel link` both
  print the database with the password taken out. That is worth *pointing at* in
  the film rather than hiding.

---

## The take

Sixty seconds, seven scenes. Timings are targets — ±2s per scene is fine as long
as the total holds.

| # | Time | Screen | What you do | What the viewer must see |
|---|---|---|---|---|
| 1 | 0:00–0:05 | Editor | Scroll once through Crewbase's `src/` and stop on `db/schema/`. | A real application. Tables, enums, an endpoint. No admin anywhere in it. |
| 2 | 0:05–0:11 | Terminal | Type `npx repanel dev`. Let it fail. | `No definition found` and the hint that names the file to write. The tool asking for exactly one thing. |
| 3 | 0:11–0:26 | Agent | Paste the prompt (below). Speed the middle to 4×, drop back to 1× for the last file written. | `repanel/app.json` and five files under `repanel/resources/` appearing. Nobody writing a screen. |
| 4 | 0:26–0:33 | Terminal | `repanel dev` again. Press Enter at the database question. | `✓ Crewbase Admin — 5 resources`, the masked database, and the address in cyan. |
| 5 | 0:33–0:42 | Browser | Open the address. Candidates. Type `har` in search, set **Status → verified**, click a row. | Sixty records; filters that work; a detail page with the placement resolved to an airline's name, the JSONB opened, applications underneath. |
| 6 | 0:42–0:52 | Browser | **Airlines** → a `pending` one → **Approve** → confirm. | The confirmation sentence the definition carries, the toast, the badge turning `approved`. This is Crewbase's own rule running, not a field edit. |
| 7 | 0:52–1:00 | Terminal → Browser | `repanel link`, then `repanel deploy`. Cut the browser round-trip. | `Connected localhost:5433/crewbase to Crewbase.` then `Admin http://localhost:5174/a/…` — and one second of the same admin at that address. |

**The two frames that have to land.** Scene 4's banner, because it is the moment
the thing exists, and scene 5's record page, because it is the moment it looks
like a product. Cut the thumbnail from one of those two.

**The intermission, between scenes 4 and 6.** Scene 6 calls Crewbase over a
signed request, and the secret it signs with is generated fresh by the
`repanel dev` in scene 4. So stop recording after scene 5, and:

```bash
# copy the REPANEL_ACTION_SECRET that scene 4's `repanel dev` printed
sed -i '' "s|^REPANEL_ACTION_SECRET=.*|REPANEL_ACTION_SECRET=<paste>|" examples/crewbase/.env
# restart Crewbase so it reads it; leave `repanel dev` running
```

Without it, **Approve** correctly comes back as a refusal — which is the
signature check working, and which is a fine thing to know and a terrible thing
to film. Scene 6 opens on a new browser shot, so the cut is invisible.

---

## Exact strings

**Scene 2 and 4, typed:**

```
npx repanel dev
```

**Scene 3, pasted to the agent:**

```text
Read this app's schema and write a RePanel admin definition into repanel/.
Airlines have an approval rule in src/airlines — use the endpoint, not a direct write.
```

That second sentence is the one that makes scene 6 possible, and it is the
honest instruction: the rule is in the application, and the agent has to notice.
With the [skill](../skills/README.md) installed it notices without being told —
worth a second take if you want to film that instead.

**Scene 5, typed into the search box:** `har`

**Scene 7, typed:**

```
repanel link
repanel deploy
```

`link` asks two questions — which project, and whether to connect the database
it found. Answer the first with Enter (the default), the second with `y`. Cut
between the line `Sign in to RePanel to authorize this machine:` and
`Signed in as …`; the browser round-trip is four seconds of nothing.

---

## Reset between takes

```bash
rm -rf examples/crewbase/repanel                    # back to no admin
git checkout -- examples/crewbase/repanel 2>/dev/null || \
  cp -R /tmp/repanel-definition examples/crewbase/repanel   # when the agent step is being skipped
pnpm --filter crewbase seed                         # the approved airline goes back to pending
```

Two things to know about re-seeding: it truncates first, so nothing accumulates
across takes, and **the primary keys are new every time**. A URL you bookmarked
in the last take will 404 in this one — navigate to records by clicking, never
by pasting.

---

## If you want one unbroken take

Drop scene 6's airline and use a candidate instead: **Mark verified** on any
`new` candidate is a guarded write straight to the database, so it needs no
secret, no restart and no intermission. You lose the strongest claim in the
film — that the application's own rule is what ran — so make this the fallback
rather than the plan.

---

## What this film does not claim

It shows reading, and it shows the two kinds of action. It does not show a form,
an audit trail, a second operator or a rollback, because those are not built yet
— the README's preview box says so, with the task each one is waiting on, and
the video should not quietly imply otherwise. No captions about "everything your
team needs"; the honest line is the one the product actually keeps.
