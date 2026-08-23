# SkyScout

A small aviation staffing marketplace, and RePanel's reference customer
application. It exists to be *administered*: a coding agent inspects this
repository, writes a RePanel definition from what it finds, and the resulting
admin is judged on whether it handled what is in here.

There is no UI. What SkyScout has is a database worth administering and one
admin-API module RePanel is allowed to call.

## Run it

```bash
cp .env.example .env
docker compose up -d          # postgres on 5433, so RePanel's own db can stay on 5432
pnpm --filter skyscout db:push
pnpm --filter skyscout seed   # ~200 rows
pnpm --filter skyscout dev    # http://localhost:3002
```

`seed` is re-runnable: it truncates first, and the data is generated from a
fixed seed, so two people looking at SkyScout are looking at the same rows.

## The data

| Table | What it is |
|---|---|
| `users` | SkyScout's own staff, the people who run placements. |
| `airlines` | The hiring side. Approving one is a business decision, not a field edit. |
| `candidates` | Pilots, crew, engineers and dispatchers. **The hostile resource.** |
| `job_openings` | Seats an approved airline is hiring for. |
| `applications` | One candidate against one opening. |

## The admin API

One module, mounted at `/repanel`, behind one verification middleware
(`src/repanel/`). It holds a single route:

```
POST /repanel/airlines/:id/approve
```

It approves an airline **only if it is still pending** — anything else answers
409, and an airline that does not exist answers 404. The rule lives in
`src/airlines/airlines.service.ts`, because that is where it belongs: an admin
that flipped `approval_status` directly could approve an airline that had
already been rejected.

Every request to `/repanel/*` must carry a valid RePanel signature or it is
refused with 401 before it reaches a controller. The scheme is
[`docs/SIGNING.md`](../../docs/SIGNING.md) and the implementation is
`src/repanel/repanel-signature.ts` — an HMAC over `<timestamp>.<METHOD> <URL>`,
compared in constant time, with a five-minute tolerance so a captured request
stops working. `REPANEL_ACTION_SECRET` is the project's action secret, copied
from the RePanel console (Project → Agent access).

`pnpm --filter skyscout test` covers exactly that endpoint: signed and pending →
approved, signed and not pending → 409, unknown airline → 404, wrong secret →
401, no signature → 401, expired timestamp → 401.

## The traps (for humans reading this)

The point of SkyScout is that a naive admin over these tables would be wrong in
ways that matter. Each of these is something an authoring agent has to classify
correctly, and `docs/AUTHORING.md` is what tells it how.

1. **`users.password_hash`** — a credential sitting in the most ordinary-looking
   table in the schema. It must be marked `sensitive`, which keeps it out of
   columns, search, filters, sorting and action URLs. A hash is not "safe
   because it is hashed": it is an offline cracking target and it must never
   leave the API.

2. **`candidates.status`** — an enum with a workflow behind it. The trap is
   treating it as a field to edit. In a v0 definition every resource is
   read-only, so the correct shape is an *action* that moves it. There is no
   endpoint for it in SkyScout because there is no rule to enforce, which makes
   a `dbUpdate` action the honest answer here — unlike `airlines.approval_status`.

3. **`candidates.deleted_at`** — a soft delete. Rows with it set are gone as far
   as the product is concerned, but they are still in the table, so an admin
   that lists them is showing deleted people to an operator. Mark it `hidden`.
   RePanel v0 cannot filter them out by default; the guide says so plainly
   rather than pretending otherwise.

4. **`candidates.profile`** and **`airlines.verification`** — JSONB written by
   and for internal code. The shape is unstable and the contents are working
   notes, so they belong on the detail page at most, never in a table column.

5. **`airlines.approval_status`** — the one with a rule. Only a pending airline
   may be approved, and the rule is in this repository, not in the definition.
   The definition's job is to point an action at `POST
   /repanel/airlines/{id}/approve` and let the application answer.

## Layout

```
src/
  airlines/    the approval rule, and the only writes SkyScout performs
  config/      zod-validated environment, read through one typed service
  db/          drizzle schema, one file per table
  repanel/     the admin API: signature middleware + the routes RePanel may call
  seed/        ~200 deterministic rows
```
