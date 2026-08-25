# Task F-3 · The relation picker — one control, two surfaces

Screenshots of the built runtime served by `repanel dev` against **Crewbase's
own database**. Every name in these lists came out of `airlines` a moment
before the shutter: the box asked `GET /api/runtime/local/resources/airlines/options`,
and the engine answered with twelve keys and twelve labels. 1440×900 at 2×.

| | light | dark |
|---|---|---|
| The form's relation field, open | `form-picker-light.png` | `form-picker-dark.png` |
| The table's relation filter, narrowing | `filter-picker-light.png` | `filter-picker-dark.png` |
| A key that names no record the search found | `form-key-light.png` | — |

## What each one is evidence of

**`form-picker-*`** — the box opens on the *name* of the record the opening
points at (`Pampas Connect`), not on its uuid, because the read path resolved
that label on the way in and the form spends it. The list under it is every
airline rather than the one whose name is in the box: opening a picker is asking
what else there is. Two facts are on screen at once and they are drawn
differently — the row under the keyboard wears the highlight, and the record the
field currently holds wears the check.

**`filter-picker-*`** — the same control above the table, wearing the filter's
own clothes: its label inside the box, `Any` as the row that takes the value
away, and the trigger quiet until it is answered — the voice `Status` and
`Created` already speak. `air` has been typed, and the list is the three airlines
whose names match it. This is the surface that carried the v0 debt: it used to
be a box an operator pasted a uuid into.

**`form-key-light`** — the fallback, and the whole of it. A pasted key finds
nothing, because the search is over labels; the list answers with one row
offering the text as a key, in the data face. It appears on exactly that
condition — while a search is still matching records there is no such row
(DECISIONS #060).

## Proven against postgres, not against a fixture

```
GET …/resources/airlines/options            200, 12 records, key + label, nothing else
GET …/resources/airlines/options?q=nor      200, Aurora Nordic + Northwind Air
GET …/resources/airlines/options?query=nor  400, bad_request — a typo is refused, not answered
```

The engine's own specs prove the rest of the shape against a real server: the
statement times out with the pool's five seconds, a `%` in the box is a literal
`%`, a sensitive label field refuses the whole resource, and the limit is twenty
whatever is asked (`apps/api/src/runtime/runtime.integration.spec.ts`,
`packages/engine/src/query/options.spec.ts`).
