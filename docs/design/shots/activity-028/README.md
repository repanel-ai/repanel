# Task 028 · The audit log — a record's Activity

Screenshots of the built runtime served by `repanel dev` against **Crewbase's
own database** — the reference customer application, its real definition and
its real rows. Every line in these panels is an event the engine filed for a
write that actually happened: a form edit, a refusal from the value check, a
`dbUpdate` action, and Crewbase's own endpoint answering 409.

1440×900 at 2×.

| | light | dark |
|---|---|---|
| Inline, on an opening: an edit, a refusal and an action | `activity-light.png` | `activity-dark.png` |
| Tabbed, on an airline: an `httpCall` and the 409 path | `activity-tab-light.png` | `activity-tab-dark.png` |

## What each one is evidence of

**`activity-*`** — `job_openings` lays its related lists out inline, so Activity
is the last section on the page, under the record's own facts and under the
lists of other records. It does not wear §5's dotted rule and the `Applications`
heading above it does: that mark means "this belongs to a different record", and
a record's own history is not that.

Three lines, newest first:

- **`Close opening`** — a `dbUpdate` action, with the column on both sides of
  it: `Status open → closed`. Both readings came out of the one statement that
  performed the write, so the pair is a fact about one moment rather than two
  reads with a gap between them (DECISIONS #056, #061). `open` is inked in the
  tone the definition gave it and `closed` is not, because Crewbase's `tones`
  map names one and not the other — the runtime reads severity out of the
  definition or out of nothing (#029).
- **`Edited` · `validation failed`** — a `status` of `archived`, which the enum
  does not hold. The write never reached the database and the line says so: the
  badge carries the same category the request itself was answered with, and the
  Change column is the em-dash this admin says nothing with. **No values are
  recorded for a refusal** — nothing was replaced, and what was submitted and
  rejected is not something a log should keep.
- **`Edited`** — a form write, named in the runtime's own word for it because a
  form is the runtime's screen and has none of the definition's.

A success wears no badge. Almost every line of a healthy log is one, and a
column of identical badges is a column that has stopped saying anything.

**`activity-tab-*`** — `airlines` lays its related lists out as tabs, so Activity
is the last tab. `Openings` and `Candidates` wear the dotted rule; `Details` and
`Activity` do not, and that is the same rule rather than an exception to it —
both panels are about the record in the header.

Two lines, both the `approve` action, and the pair the task's acceptance names:

- **`Approve`** — the airline was pending, Crewbase's endpoint approved it, and
  the badge on the header now reads `approved`.
- **`Approve` · `action rejected`** — the same button pressed again. Crewbase
  answers 409, because only a pending airline can be approved; the engine calls
  that `action_rejected` and the log calls it a refusal rather than a failure —
  a refusal is a thing to argue with, a failure a thing to retry.

Both carry no field values, and that is the honest answer: an `httpCall` runs
inside the customer's application, RePanel does not read the response, and an
admin that guessed at what a call changed would be filing a guess.

The address of the Activity tab is `?tab=-activity`. No definition identifier
may start with `-`, so a relationship called `activity` and the runtime's own
panel can never be the same address.

## Not shown here, and why

**A sensitive value, anywhere.** That is the point. The columns a log records
are the columns a write named, and a `sensitive` field can be neither written
(#055) nor selected (`columns.ts`) — so there is no arrangement of these panels
that could show one. It is asserted by test at the statement, at the writer, and
against a real Postgres, rather than by looking at a screenshot.

**The hosted `audit_events` table.** These are `repanel dev`, whose log lives in
memory for the life of the process (DECISIONS #061) — the same panel, over the
same contract, drawn by the same build. What the hosted table does with the same
events is covered by `runtime.integration.spec.ts`, which runs against a real
server.

## Measured, from the rendered DOM

Read out of the served app on the opening above, both themes, against a 4.5
requirement.

```
overflow   light  scrollWidth === clientWidth at 1440 and at 768
           dark   scrollWidth === clientWidth at 1440 and at 768

contrast          light   dark
  the badge        5.01    4.82
  a toned value    5.41    6.20
  the column head  5.75    5.94
  the moment       5.75    5.94
  the event        19.71  16.06
```
