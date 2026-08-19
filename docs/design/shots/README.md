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
