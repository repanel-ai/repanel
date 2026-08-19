# Task 010 · Stage 1 — three concepts

Static, self-contained. Open a file directly; append `?theme=dark` for dark
(dark was designed first in B and C).

| | Concept | Thesis | Type | Density | Signature |
|---|---|---|---|---|---|
| A | `concept-a.html` | the shadcn preset `b7Br6PMSh`, rendered faithfully | Geist | shadcn default, 41px rows | — (baseline) |
| **A2** | **`concept-a2.html`** | **A refined against ref-1 — selected direction** | **Geist, four sizes** | **36px rows, 18 visible** | **— (baseline)** |
| B | `concept-b.html` | **Ledger** — an admin is a document | IBM Plex Sans + Plex Mono for data | 40px rows, 3 surface layers | the key gutter |
| C | `concept-c.html` | **Console** — the table is the interface | Instrument Sans only, tabular figures | 32px rows, 1 surface | the query line |

`shots/` holds `{a,b,c}-{dark,light,768}.png` at 2× — the screenshots the
comparison is written against.

## The floor, measured

Contrast is measured from the rendered DOM (computed colour over the first
opaque painted ancestor), not from the palette on paper:

```
concept-a  dark  15 text styles, 0 below AA   tightest 6.06
concept-a  light 15 text styles, 0 below AA   tightest 4.58
concept-a2 dark  19 text styles, 0 below AA   tightest 4.78
concept-a2 light 19 text styles, 0 below AA   tightest 4.80
concept-b dark  26 text styles, 0 below AA   tightest 4.55
concept-b light 26 text styles, 0 below AA   tightest 4.60
concept-c dark  25 text styles, 0 below AA   tightest 4.60
concept-c light 25 text styles, 0 below AA   tightest 4.66
```

Focus styling is rendered statically on the search field in all three (the
element `/` targets), alongside real `:focus-visible` rules on nav items,
controls, buttons and table rows. At 768px no concept scrolls horizontally at
the document level (`scrollWidth === clientWidth === 768`).

## Where A's numbers come from

`../preset-b7Br6PMSh.css` is the verbatim output of
`pnpm dlx shadcn@latest apply --preset b7Br6PMSh`, run in a throwaway Vite
project outside this repo and then deleted. A spends those values; it invents
none. Three deviations were forced by the AA floor and are listed in the file's
own header comment — the preset's `--sidebar-primary` pairing measures 3.09 in
light, its light `--muted-foreground` measures 4.14 on its own `--muted`, and
shadcn's `text-white` destructive badge measures 2.89 on the preset's dark red.

## Banned defaults applied to B and C

The task file does not carry a banned-defaults list, so this one was derived
from its own language ("not a generated database browser", "restraint over
decoration") and from DECISIONS #005/#026. It is a proposal, not a ruling.

1. Inter / Roboto / `system-ui` as the UI face — and Space Grotesk as the
   "designer default" that replaces them.
2. Violet, indigo or purple as the accent.
3. Rainbow pastel pill badges — one tinted `rounded-full` per enum value.
4. Drop shadows as the elevation mechanism.
5. Gradient surfaces, glassmorphism, blurred panels.
6. Zebra striping, and heavy grid lines on tables.
7. The tinted-pill-plus-left-bar active nav state (both human references use
   it; that is why A keeps it and B and C may not).
8. Avatar circles as row decoration.
9. Hero metric numbers with up/down delta chips.


## A2 — what changed from A

Type comes down to four sizes and the rhythm tightens with it:

| | A | A2 |
|---|---|---|
| nav label · table cell · controls | 14px | **13.5px** |
| column header · breadcrumb · page meta · pagination | 14 / 12px | **12.5px** |
| page title | 24px | **20px** |
| counts · badges · `/` hint · project line | 12px | **11.5px** |
| nav row / control / table row / topbar | 32 / 36 / 41 / 56px | **30 / 32 / 36 / 48px** |
| sidebar width | 256px | **236px** |
| records visible at 1440×900 | 14 | **18** |

Four other changes, each with a reason:

- **Neutrals stay cool but stop reading cyan.** Hue moves off the preset's 214
  to a plain cool grey at 265, with chroma dialled to 65% of the preset's, so the
  cast is present and quiet. Lightness ratios are the preset's own throughout.
  `shots/cmp-warmth-{light,dark}.png` is the A/B against the warm pass that
  preceded it.
- **The sidebar step becomes real**: 1.234:1 in light against A's 1.039:1
  (ref-1's own is 1.266:1). The raised inset panel now reads without the border
  having to carry it alone.
- **Dark agrees with light about which surface is raised.** shadcn's inset
  variant puts the panel *below* the sidebar in lightness; in A2 the panel is
  above it in both themes.
- **Status badges become one family** — same border, padding and radius for all
  three states, differing only in fill weight and text colour. shadcn's
  saturated `destructive` fill made "suspended" the loudest thing on the page,
  and shrinking everything around it made that worse.

### Sizing against shadcn

The rule `packages/ui` should encode: **shadcn's `sm` sizes become the default
sizes for controls; the table and badge get their own tighter scale; radii and
component composition are untouched.**

| | shadcn default | A2 |
|---|---|---|
| Button | `h-9 px-4` → 36 / 16 | 32 / 12 |
| Icon button | `size-9` → 36 | 32 |
| Input | `h-9 px-3` → 36 / 12 | 32 / 12 |
| Sidebar menu item | `h-8 px-2 text-sm` → 32 / 8 / 14 | 30 / 8 / 13.5 |
| Sidebar width | `16rem` → 256 | 236 |
| Table header | `h-10 px-2` → 40 / 8 | 34 / 10 |
| Table cell | `p-2` → 8, ~40 row | 36 / 10 |
| Badge | `px-2 py-0.5 text-xs` → 8 / 2 / 12 | 7 / 1 / 11.5 |
| Inset panel | `m-2 rounded-xl shadow-sm` | `m-2 rounded-xl`, no shadow |
| Radii | `--radius .45rem` + the preset's ramp | unchanged |

The shadow is dropped deliberately: all three references build depth from two
flat surfaces at different lightness plus a hairline, and with a real sidebar
step the shadow only muddied the panel edge.

### Icons — a schema change, not a style choice

The nav carries icons, and they come from the definition. Assumed field:

- **`resource.icon`** — optional, one name from a fixed vocabulary.
- **Unknown name** → validation error listing the whole vocabulary, never
  truncated (#020).
- **Omitted** → falls back to `table`, so definitions written before the field
  existed still render.
- **Groups get none.** Resources are the navigable items; group labels are
  section headers, which ref-1 does not put icons on either.
- **Glyphs are drawn in-repo** (#026), 24×24 on a 1.5 stroke, rendered at 16px.
  No icon-library dependency.

Proposed vocabulary (28): `user users building key shield cart receipt
credit-card package truck tag wallet file folder image book message mail
database webhook terminal activity bell clock calendar settings chart globe
link table`.

A runtime that mapped resource keys to glyphs itself would be the per-resource
hardcoding 010's acceptance criteria forbid; a free-form icon name would put a
silent missing-glyph state on screen, which is the failure mode #027 just closed
everywhere else. This is `packages/contracts` work (task 001's domain) and needs
its own decision entry — it is not in 010's scope.
