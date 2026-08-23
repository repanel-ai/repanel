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

---

# Task 014b · Stage 1 — the console

## Round 1 — `console-a.html`, REJECTED

`console-a.html` (shots `shots/console-a-{light,dark}.png`) gave the console the
runtime's skeleton on a warm layer: cream-paper chrome, the runtime's terracotta
`--primary`, three warm light surfaces.

**Rejected on direction, not on refinement.** Two reasons, both fair:

1. **It lands on 010's banned-defaults list in spirit** — cream paper plus a
   terracotta accent is a named generated-design cliché, and the list exists
   precisely to keep this product off it.
2. **It reads editorial where it has to read like infrastructure.** A control
   plane is where somebody points a production database at a service. Warm
   paper says "read me"; this screen has to say "operate me."

The reference class is the professional SaaS console: Stripe, Linear, Vercel,
Supabase. Cool, precise, unfussy. The file is kept as the record of what was
tried; it is not a candidate.

## Round 2 — two concepts, both cool, both light-first

| | **B — Elevation** | **C — Instrument** |
|---|---|---|
| file | `console-b.html` | `console-c.html` |
| shots | `shots/console-b-{light,dark}.png` | `shots/console-c-{light,dark}.png` |
| thesis | the thing to do next is the thing nearest your eye | one sheet, ruled into what it reports and what it can do |
| reference | Stripe's dashboard | Linear / Vercel / Datadog |
| surface strategy | **three planes** — slate chrome, slate panel, white cards floating on it | **two surfaces and a well** — slate chrome, one white sheet, a recessed well |
| grouping | by plane: things on the same plane belong together | by rule: a hairline is the whole boundary |
| status cards | three separate cards, gapped | three **cells** of one object, sharing borders |
| checklist | four **cards** in a stack; the current one lifted | four **rows** of one object; the current one marked in the gutter |
| shadow | two steps — `--lift-1` every card, `--lift-2` spent once | **one step**, on the panel, and none inside it |
| accent | signal blue `#0e5fce` (dark `#2b6cd4`) | deep teal `#0e6b75` (dark `#1a9dab`) |
| current page | filled pill, accent glyph, no bar | no fill, accent rule on the item's edge, ink label |
| card label | small caps, micro, muted | sentence case, `--t-small` — a column header |

The two differ in surface strategy, accent family and shadow usage, not in hue.
Swap the palettes and they would still be two different arguments about what
makes a group a group.

### On the accent, and on the banned-defaults list

Both accents are deliberately **outside the indigo/violet/purple family**, which
010's banned list names by hand. B's is a pure blue at hue 215; C's is a teal
far enough from the `positive` green (`#137a3f`) in both hue and lightness that
a mark is never read as a state. Neither is warm; neither is borrowed.

**Whichever is selected is proposed for BOTH theme layers** — a
brand-unification ride-along replacing `--primary` `#bb4d00` on
`.theme-runtime` too, with its own decision entry and a re-shoot of every
runtime screenshot. One product has one accent. Selecting a console concept
should not accidentally select a two-accent product, so it is said here.

Each concept spends its accent in exactly four places, all of them "you are
here": the project's mark, the current page, the current step, and the one
primary action on the screen. Nowhere else.

### On shadow, which 010 banned and this task permits

010's list bans "drop shadows as the elevation mechanism", and DESIGN.md §2
rules "no drop shadows anywhere". That ruling is right **for the runtime**,
where a shadow under a table row muddies the one flat field five hundred
records are read on — and it is the wrong rule for a console of eight distinct
objects, each a different thing you do.

So the permission is taken at the **layer**, not in a component: `--lift-1` and
`--lift-2` are tokens `.theme-console` carries and `.theme-runtime` resolves to
`none`. §2 stands unamended for the surface it was written about, and no app
writes a `box-shadow` of its own. Both concepts stay inside two steps; C uses
one.

Shadow is also a light-theme mechanism, and both files say so: a black shadow on
a black ground is nothing, so dark restates the same steps in lightness and
keeps the hairlines.

### Measured, from the rendered DOM

```
                     B — Elevation            C — Instrument
contrast   light     26 styles, 0 below AA    21 styles, 0 below AA
                     tightest 4.65            tightest 4.74
           dark      26 styles, 0 below AA    21 styles, 0 below AA
                     tightest 4.80            tightest 4.81

surface    light     chrome .8442 -> .7961    chrome .8190 -> .7712
ladder               panel  .9205             sheet  1.0000
                     card   1.0000            well   .9114
           dark      chrome .0040 -> .0028    chrome .0043 -> .0026
                     panel  .0070             sheet  .0068
                     card   .0109             well   .0120

overflow             1440 and 768, both themes, both concepts: no horizontal
                     scroll (scrollWidth === clientWidth)
numerals             tabular-nums;  faces Geist + Geist Mono
```

Light's tightest pair is the `positive` badge in both (4.74) — the number
DESIGN.md §4 records for it, because both concepts spend the runtime's tone
family unchanged. The state tones are semantics, not chrome: `positive` has to
read as "this went well" on any layer. Nothing in either **base** is warm.

### Self-critique, once each, against "would Stripe ship this"

Three findings, two of them shared:

- **Neither screen had a primary action.** Both spent the accent on the project
  mark, the current page and the current step — and then the one thing the page
  is actually asking for, the setup command, was an unlabelled icon inside a
  code box. It is now a `Copy command` button at the control size beside the
  snippet: one primary action per screen, and the fourth place the accent is
  spent. Stripe would not ship a setup page whose call to action is an icon.
- **Dashed borders on the not-yet-reachable step** read as a drop zone rather
  than as a future. B's fourth step is now a flat outlined card resting on the
  panel with no lift; C's is a row like any other with a solid ring for its
  number.
- **B marked its current card twice** — `--lift-2` *and* a blue-tinted border —
  which is the same "two languages for one idea" the rejected concept was
  criticised for. The tint is gone; the card is simply closer, which was the
  thesis.
- **C hung its current-page mark in a gutter outside the sidebar's padding**,
  which put two pixels of teal flush against the window edge, where it read as
  a rendering artefact. It sits on the item's own left edge now.

### Recommendation

**B — Elevation**, on the structure, with one caveat about the accent.

Why B: this page's whole job is to say what to do next, and B answers it
spatially — the current step is literally nearer, which needs no colour, no
legend and no second look. C answers it with two pixels of teal, which is a mark
you have to notice. B also scales to the pages that come next: Connection and
Agent access are forms, forms want a card on a field, and B already has that
language while C would have to invent a container for them. And the reference
class the rejection named leads with Stripe, which is the argument B is making.

Why not C, though it is the closer sibling: C's line-led sheet is genuinely
nearer the runtime's own table language, which is a real argument for product
coherence, and its dark theme is the stronger of the two. But C is a
*dark-first* aesthetic being asked to run light-first, and its light theme is
where it is least itself — a white sheet on a grey ground with hairlines is
correct and a little inert.

**The caveat, and it is a separable decision.** The surface strategy and the
accent are independent: B's structure carries either colour unchanged. If the
accent is going to become RePanel's brand — and per above, selecting one makes
it exactly that, on both layers — then **C's teal is the better brand than B's
blue.** A signal blue is the right colour for this page and the most crowded
colour in the category; the teal is distinct, equally cool, equally
professional, and passes every contrast pair. If that reasoning lands, the
selection to make is *B's structure with C's accent*, which costs a palette
swap and nothing else.

