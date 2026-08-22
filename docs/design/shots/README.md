# Task 010 · Stage 2 — checkpoint C

Screenshots of the built runtime (`apps/runtime`), rendered against the shared
fixture definition (`@repanel/contracts/fixtures`) and a stubbed records API —
the same inputs the specs use, so what a shot shows is what a test asserts.

1440×900 at 2×, except `narrow-768-*` (768 wide). The project key in each shot
picks the scenario, which is why the sidebar reads `acme-slow` on the loading
shot and `acme-broken` on the error one.

| | light | dark |
|---|---|---|
| Shell + table with data | `table-light.png` | `table-dark.png` |
| A second resource (numbers, references) | `orders-light.png` | `orders-dark.png` |
| Filters set, date range open | `filters-open-light.png` | `filters-open-dark.png` |
| Loading | `loading-light.png` | `loading-dark.png` |
| Empty — nothing here yet | `empty-light.png` | `empty-dark.png` |
| Empty — nothing matches | `no-matches-light.png` | `no-matches-dark.png` |
| Error, with the way to ask again | `error-light.png` | `error-dark.png` |
| 768px | `narrow-768-light.png` | `narrow-768-dark.png` |
| Data face: the mono variant | `data-face-mono-light.png` | `data-face-mono-dark.png` |
| Footer docked at four rows | `footer-docked-light.png` | — |

## Measured, from the rendered DOM

Read out of the built app, not restated from the palette.

```
contrast      light  16 distinct text styles, 0 below AA   tightest 4.63
              dark   17 distinct text styles, 0 below AA   tightest 5.54

type scale    badge 11.5 · column header 12.5 · cell 13.5 · control 13.5
              page title 20 · nav item 14 · group label 12   (measured, px)

surface       light  chrome .7720 → .7121   panel 1.0000   row hover #f2f3f3
ladder        dark   chrome .0019 → .0010   panel .0104    row hover #2b2b2d
              (relative luminance; three steps, panel above the chrome in both
              themes. The ground the panel floats in measures identical to the
              sidebar's top — they are one surface, see DESIGN.md §2)

768px         scrollWidth === clientWidth === 768, both themes
footer        gap between the last row and the footer at four records: 0px
numerals      font-variant-numeric on a table cell: tabular-nums
faces         self-hosted (@fontsource-variable); rendered family: Geist Variable
              zero external requests;  .data-mono re-points --font-data to Geist Mono
```

## The two decisions this checkpoint is for

**1. The data face.** `table-*.png` sets machine-shaped values (ids, emails,
dates, quantities) in Geist; `data-face-mono-*.png` sets them in Geist Mono.
Everything else is identical — the face is the `--font-data` token and the
variant is one line in `tokens.css`, so either answer costs the same.

*Ruled after 011, on these shots and the record ones below: the sans.
DESIGN.md §3 records why. The mono shots stay as the evidence the ruling was
made from; `.data-mono` stays in `tokens.css` as a dormant mechanism, and the
dev toggle that drove it is gone.*

**2. Badges are uniformly quiet, and that is the rule working.** DESIGN.md §4
says a state earns the tinted treatment only where the definition marks it as
such, and the runtime never guesses severity from a value's spelling. v0's schema
has no way to mark it, so every enum value renders quiet — `active`, `invited`
and `suspended` look alike in these shots. The louder treatments are built and
tested in `packages/ui`, waiting for a signal to spend them on. That signal is
now settled: DECISIONS #029 adds an optional `tones` map on enum fields, and it
is implemented with task 011.

Dates are the same kind of answer: one fixed shape in UTC rather than the
reader's locale (DECISIONS #030), with a project-level display timezone as the
additive future.

---

# Task 011 · detail pages

The record surfaces, shot the same way: the shared fixture definition
(`@repanel/contracts/fixtures`, validated as the API validates it) against a
stubbed records API. `users` carries one field of every type the schema has, so
one record exercises every renderer.

| | sans | mono |
|---|---|---|
| A record in full — light | `record-light.png` | `record-mono-light.png` |
| A record in full — dark | `record-dark.png` | `record-mono-dark.png` |
| Not found — light | `record-not-found-light.png` | `record-not-found-mono-light.png` |
| Not found — dark | `record-not-found-dark.png` | `record-not-found-mono-dark.png` |
| Loading — light | `record-loading-light.png` | `record-loading-mono-light.png` |
| Loading — dark | `record-loading-dark.png` | `record-loading-mono-dark.png` |

The same record page with `relatedLayout: "tabs"` — `organizations` in the
fixture asks for it, `users` stays inline, so both answers are real:

| | light | dark |
|---|---|---|
| Tabs, on the record's own facts | `record-tabs-light.png` | `record-tabs-dark.png` |
| Tabs, on a related list | `record-tabs-related-light.png` | `record-tabs-related-dark.png` |

`record-tabs-related-*` is also the first shot with all three spent tones in one
column: `active` positive, `invited` neutral, `suspended` critical.

1440 wide at 2×. The record shots are 1324 tall rather than 900: the panel
scrolls its own content, so a shot of the real screen would end mid-record —
the viewport is grown to the record's height so the whole of it is reviewable
in one image. The other two fit in the real 900.

The record shots carry every field type — text, longText, number, boolean,
date, dateTime, email, url, enum, json, relation — plus a hidden field shown
(`preferences`), the JSON block opened, a `belongsTo` related list and a
`hasMany` one with paging.

## The data face — the trial, both variants

`--font-data` is swapped through the existing `.data-mono` class by a temporary
dev-only toggle beside the theme toggle, labelled `01` in the face it is asking
about. In the mono shots every machine-shaped value moves: the record id, the
email and url, both dates and the clock, the quantity, the JSON summary and the
pretty block, and every id, reference and timestamp in the related lists. Prose
— the record's name, the notes, the labels, the section titles — does not.

The loading and not-found shots differ between the two variants only in the
toggle's own label: neither surface carries a machine-shaped value, which is
itself worth seeing.

The trial is closed: the sans won, `--font-data` is hardcoded to it, and the
toggle, its hook and its storage key are deleted. DESIGN.md §3 carries the
ruling and what closed it. The mono shots are kept as the evidence — they are
the comparison the decision was made on, and re-taking them would need the
mechanism back.

## Measured, from the rendered DOM

Read out of the running app, both themes, on the record page with the JSON block
open.

```
contrast      light  18 distinct text styles, 0 below AA   tightest 4.74
              dark   19 distinct text styles, 0 below AA   tightest 4.94
              (the tightest pair in both is the `positive` badge, by design —
               the tinted tones are tuned to one another's weight, not to the
               maximum available)

badge tones   light  neutral 14.40 · positive 4.74 · attention 5.01 · critical 5.12
              dark   neutral 12.27 · positive 4.94 · attention 4.82 · critical 4.79
              (all four drawn and measured; the fixture reaches two of them, so
               `attention` and `neutral` were drawn to be read)

overflow      scrollWidth === clientWidth === 1440, both themes

rhythm        field row 36px (20px line box + 8px air, both cells)
              related list: head 28px, row 30px — one step under the table's
              34/36, and nothing else about it changes

related       inline: the list's heading wears §5's dotted rule and the
              record's own section titles do not — one mark, at the scale of a
              block instead of a cell
              tabbed: the relationship tabs wear it and `Details` does not; the
              current tab's 2px rule sits on the bar's hairline, ~10px below
              the dotted one, so the two marks never collide

sidebar       group label 11.5/600 #665e53 · item 13.5/500 #4a443b ·
              current 13.5/500 #191a1b on fill · row 30px
              (three steps, moving in size and colour together — DESIGN §3)

768px         scrollWidth === clientWidth === 768, both themes; the sidebar
              narrows to 180px and no nav label is clipped, icons and all
```

The shots were re-taken after the navigation landed its marks and its corrected
type ladder (DECISIONS #031, DESIGN §3/§8), so what they show is the sidebar as
it now is.

---

# Task 012 · actions

The same record, with what may be done to it. Shot the same way: the shared
fixture definition (`@repanel/contracts/fixtures`, validated as the API
validates it) against a stubbed API. `users` declares all three of v0's action
shapes — two `dbUpdate`s and one `httpCall` — so one record covers the lot.

| | light | dark |
|---|---|---|
| The record, with its actions | `actions-light.png` | `actions-dark.png` |
| The question, in the definition's words | `action-confirm-light.png` | `action-confirm-dark.png` |
| It ran | `action-success-light.png` | `action-success-dark.png` |
| It did not | `action-failure-light.png` | `action-failure-dark.png` |

1440×900 at 2×. The project key picks the scenario, as it does above: the
sidebar reads `acme-broken` on the failure shot, where the stubbed application
answers 500.

`action-success-*` is the invalidation, visible: the operator confirmed
`Suspend`, the record was read again, and the header badge is already
`suspended` in the `critical` tone the fixture's `tones` map gives that value —
the notice and the new state arrive together. `action-failure-*` is its
opposite: the badge still reads `active`, because nothing about the record
changed, and the toast carries the API's sanitized category message with no
word of the customer's own response body in it.

## Measured, from the rendered DOM

Read out of the running app, both themes, with the dialog open and each notice
on screen.

```
dialog        :modal true — the browser's own top layer, backdrop, focus trap
              and escape; the record behind it is inert, and none of that is
              written in this repo
              surface --card 416px wide, radius 10.08px (--radius-xl)
              step above the panel   dark +0.0063 relative luminance
                                     light 0.0000 — both #ffffff, and the
                                     backdrop (#000 at 45%) is the step
              title 19.71 / 14.54 · body 5.75 / 5.38          (light / dark)

toast tones   positive  title 4.74 / 4.94   hairline 1.30 / 1.65
              critical  title 5.12 / 4.79   description 16.56 / 12.78
                        hairline 1.40 / 1.39
              (the same tokens §4 measures, so the same numbers; hairlines sit
               in the band --border occupies at 1.31 / 1.42)

roles         success `status`, failure `alert` — one waits for a gap, the
              other is read out on arrival

controls      action buttons 32px / 13.5px / 500, `outline`, 8px apart — the
              control size, and no action drawn louder than its peers

overflow      scrollWidth === clientWidth === 1440, both themes
```

## The signing document, checked rather than written down

`docs/SIGNING.md` carries the scheme and a Node verification snippet.
`apps/api/src/actions/signing-doc.spec.ts` reads that snippet out of the
document, runs it, and points it at a request the real signer produced and a
real HTTP server received:

```
PASS src/actions/signing-doc.spec.ts
  the verification snippet in docs/SIGNING.md
    ✓ verifies a request RePanel actually signed and sent
    ✓ verifies a request under any method the schema allows
    ✓ refuses the same request under a different secret
    ✓ refuses a request with the method changed in flight
    ✓ refuses a request with the url changed in flight
    ✓ refuses a request with the timestamp changed in flight
    ✓ refuses a request with the signature changed in flight
    ✓ refuses a signature from a version it does not know
    ✓ refuses a timestamp that is missing
    ✓ refuses a timestamp that is not a number
    ✓ refuses a perfectly good signature that is too old to still be meant
    ✓ refuses a timestamp from further ahead than a clock can drift
    ✓ allows the five minutes the document says it allows

Tests: 13 passed, 13 total
```
