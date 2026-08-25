# Task 027 · Forms II — the runtime's forms

Screenshots of the built runtime served by `repanel dev` against **Crewbase's
own database** — the reference customer application, its real definition and
its real rows. Not a fixture and not a stub: every value in these shots came out
of postgres, and the refusal in `form-error-*` is the customer's own `NOT NULL`
constraint answering.

1440×900 at 2×. `job_openings` is Crewbase's one writable resource
(`writes: { create: true, update: true }`), and its three editable fields are a
required relation, a required text and a toned enum.

| | light | dark |
|---|---|---|
| The table, and the way in | `forms-table-light.png` | `forms-table-dark.png` |
| Creating a record | `form-create-light.png` | `form-create-dark.png` |
| The record it made, and the notice | `form-success-light.png` | `form-success-dark.png` |
| Correcting a record | `form-edit-light.png` | `form-edit-dark.png` |
| A refusal, under the field it names | `form-error-light.png` | `form-error-dark.png` |

## What each one is evidence of

**`forms-table-*`** — `New opening` on the table header, and nowhere else. Every
other resource in this admin declares no writes and wears no way in.

**`form-create-*`** — the fields the definition opened, in the order it declares
them; the required mark on the two that must be answered; the relation typed as
a key with the note saying so (v1 has no labelled lookup); the enum's current
value in the tone the definition gave it, as ink. The submit is the one
`primary` fill on the screen, and the entry points that opened this form are
`outline`: the fill marks the button that goes ahead, never the one that
navigates.

**`form-success-*`** — the record the write returned, already on screen, and the
notice about it in the app's own stack. *This shot also shows DESIGN.md §10's
open item, and shows it having got worse:* the notice lands on the `Edit` button
it is a notice about. The action row could previously be empty; `Edit` is there
whenever the resource takes changes, so the collision is now the common case
rather than the occasional one.

**`form-edit-*`** — opened on the values the record holds; the relation showing
what its key currently points at, wearing §5's dotted rule; `Save changes` off
because nothing has changed yet.

**`form-error-*`** — `status` set to nothing and saved. The column is
`NOT NULL`, so postgres refused it, the engine turned `23502` into a problem
with a path of `values.status`, and the form put the sentence under that input
and marked it `aria-invalid`. Nothing in the browser decided where it went; the
path did.

## Not shown here, and why

**The em-dash-to-input control.** A nullable field holding nothing draws the
em-dash the record page draws for the same fact, and pressing it puts the input
there. Crewbase cannot show it: every column of `job_openings` is `NOT NULL`, so
its one nullable *input* field does not exist. It is covered by
`form-page.spec.tsx` ("shows the em-dash until it is asked for an input", "goes
back to nothing when it is cleared, and writes nothing").

## Measured, from the rendered DOM

Read out of the served app on the create form with a refusal on it, both themes.

```
contrast   light  7 distinct text styles, 0 below AA    tightest 4.85
           dark   8 distinct text styles, 0 below AA    tightest 5.94

overflow   scrollWidth === clientWidth at 1440 and at 768, both themes
```

The tone inks the enum select spends, measured on the panel rather than on a
badge's tint — every one of them is better there, because a tint is a step
toward the ink sitting on it (the same finding DECISIONS #052 made for the
notice):

```
                light   dark
positive         5.41   6.20
attention        5.72   6.07
critical         6.09   6.02
neutral          19.71  16.06
the note's ink   5.75   5.94
```
