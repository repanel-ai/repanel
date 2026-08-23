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

## SELECTED — `console-d.html`, stock shadcn, refined

**This is the direction.** shadcn's default theme is the palette and stays the
palette: achromatic neutrals, a monochrome `--primary` that is a weight rather
than a colour, white cards on a near-white ground, its own `shadow-sm`, Geist.
Shots: `shots/console-d-{light,dark}.png` at 1440x900 and
`shots/console-d-wide-{light,dark}.png` at 2560x1440.

It began as a control — stock rendered faithfully, to show what the approved work
was buying — which means the four things that were *observations* about a control
are now defects to fix. They are, plus the compactness pass.

### The five deviations from stock, each forced

**1. The rhythm and the type come back to RePanel's.** Stock renders at
Tailwind's raw steps — 14px for body *and* for every caption under it, 24px
titles, 36px controls, a 256px sidebar, 24px gutters — which on a page of eight
small facts reads loose rather than generous, and gave a step's title and its
note the same size, so nothing was subordinate to anything.

```
body / control label      14   ->  13.5    (--t-body)
caption, note, meta       14   ->  12.5    (--t-small)
badge, card label         12   ->  11.5    (--t-micro)
page title                24   ->  20      (--t-title)
control height            36   ->  32      (--h-control)
nav item                  32   ->  30      (--h-nav)
sidebar                   256  ->  236
radius                  0.625rem -> 0.45rem, with the runtime's ramp
```

This is the compactness, and it is also what makes the whole thing a **theme
layer** rather than a fork. DESIGN.md §1 rules the type scale, the radii and the
control rhythm shared primitives no layer may move; stock moved all three, and
that was the one objection to it that was structural rather than cosmetic.
Refined stock moves none of them, so it is expressible as `.theme-console` —
colour, and nothing else. `font-variant-numeric: tabular-nums` is back at the
root, which stock leaves to per-element classes.

**2. `--muted-foreground` `#737373` → `#6f6f6f`.** Forced by the contrast floor:
stock's own `--muted-foreground` on `--muted` `#f5f5f5` measures **4.35:1**,
under the 4.5 §7 sets as a gate. Not an edge case — it is the avatar's initials
and every line of body copy inside the current step. Four values darker measures
4.61 on `--muted`, 4.81 on the page, 5.03 on a card. Task 010 recorded the same
defect in the preset it started from.

**3. The surface ladder, in both themes.** Stock dark paints the chrome
`#171717` and the inset panel `#0a0a0a`, so content sits *below* its chrome and
reads recessed — the inversion DESIGN.md §2 names in shadcn's own
`sidebar-inset` variant and corrects. Corrected the same way: chrome takes
`#0a0a0a`, panel takes `#171717`. Cards then need a step above the panel, which
stock dark has not got between `#171717` and `#262626`, so `#212121` is
interpolated — **the one value in the file that is not shadcn's.** Light needed
one step too: the active nav pill at `#f5f5f5` on a `#fafafa` sidebar measured
1.04:1 against its own ground, which is not a state but a rounding error →
`#efefef`.

**4. `--sidebar-primary` follows `--primary` in both themes.** Stock sets it
`#171717` light and `#1447e6` — a blue — dark, so the project mark, the one
object wearing it, changes colour between themes while nothing else agrees with
it. This direction is monochrome on purpose; the mark is monochrome in both.

**5. §4's `positive` and `attention` families are added.** Stock ships exactly
one state colour, and its `destructive` is already ours to the digit (`#e7000b`
/ `#ff6467` — which is where §4's family came from). The other two were missing,
so `Answered`, `Waiting` and `Never used` rendered as the same grey badge and
the one fact the connection card exists to report stopped being readable at a
glance. The runtime already ships all four tones, the schema already lets a
customer name them (#029), and the console's own status chip already spends
them; a console with no success tone could not report on the product it
administers. **Colour is spent on state and nowhere else** — the accent slot
stays monochrome, which is this direction's whole character.

### Three refinements

- **The sidebar holds two kinds of thing and now says so** — a `PROJECT` label
  over the four destinations, a rule, then `Settings` and `Sign out`. One list
  with `Settings` greyed at the bottom made "off" and "different in kind" look
  like one statement, and sign-out had no home in this shell at all.
- **A card carries a mark, tinted by its state** — 26px, quiet, coloured out of
  §4's family rather than per card. A chip whose colour told you *which* card
  you were on would be repeating the label.
- **The content has a measure** — capped at 1100px and centred, so a 2560px
  window gives two even margins instead of one enormous one. The panel still
  fills: it is the app's frame. The wide shots are why this is stated rather
  than assumed.

### Measured, from the rendered DOM

```
console-d  light  24 text styles, 0 below AA   tightest 4.61
           dark   26 text styles, 0 below AA   tightest 4.94

surface    light  chrome #fafafa .9559   panel #ffffff 1.0000   card #ffffff
ladder            (light has two surfaces and a shadow, as stock does)
           dark   chrome #0a0a0a .0030   panel #171717 .0086   card #212121 .0152
                  (three steps, panel above the chrome in both themes now)

overflow          768, 1440 and 2560, both themes: no horizontal scroll
numerals          tabular-nums;  faces Geist + Geist Mono
```

Stock measured 2 below AA in light and put the panel under the chrome in dark;
both are gone, and nothing was changed for taste that could have been left
alone.

## Round 3 — `console-e.html`, B with a voice

B's direction carrying four lessons from a reference dashboard (ShipNova).
Three of them are straightforwardly better than what B had; the fourth is a trap
and is not taken. Shots: `shots/console-e-{light,dark}.png` at 1440x900 and
`shots/console-e-wide-{light,dark}.png` at **2560x1440**, because a layout is
not verified at one width.

### 1. The face — and it is a product decision, not a console one

The reference's face has more voice than Geist: rounder bowls, a taller
x-height, a geometric build that makes a five-item nav read as a designed object
rather than a list of words. Real, and worth having.

It is also not something a theme layer may do. DESIGN.md §1 rules the font
stacks a **shared primitive** and §3 rules Geist for the whole product. So this
proposes **Plus Jakarta Sans for both surfaces**, exactly as the accent is
proposed for both — or it proposes nothing, because a console in one face and an
admin in another is two products. It re-opens §3 and re-shoots every runtime
screenshot.

**It passes §3's one hard gate.** Tabular figures are not a preference there:
the default figures of most faces are proportional, and every column of dates,
ids, counts and page ranges depends on `tabular-nums` working. Measured in the
browser at 40px, ten `1`s against ten `0`s:

```
Plus Jakarta Sans   proportional 148.4 / 292.8    tabular 240.0 / 240.0   ok
Geist               proportional 139.2 / 268.8    tabular 240.0 / 240.0   ok
Manrope             proportional 156.0 / 244.0    tabular 248.0 / 248.0   ok
Figtree             proportional 165.3 / 256.3    tabular 249.3 / 249.3   ok
Be Vietnam Pro      proportional 154.0 / 270.4    tabular 154.0 / 270.4   NONE
```

Geist's row reproduces §3's own recorded numbers exactly, which is how the
harness was checked before the other rows were believed. Plus Jakarta Sans's
tabular advance is 240px — **Geist's exactly** — so swapping the face changes no
column's width. Be Vietnam Pro is listed because it was a candidate and silently
has no `tnum` at all: the failure mode §3 warns about, and the reason this is
measured rather than assumed. Manrope and Figtree also pass, so the family is a
choice within a shortlist rather than a single option.

It self-hosts through the mechanism already in use —
`@fontsource-variable/plus-jakarta-sans`, one dependency swapped for another, no
CDN. Geist Mono stays for the command; nothing about it was the complaint.

### 2. The icons — larger, heavier, and carrying meaning

Ours were 16px on a 1.5 stroke, a footnote beside its word. Here a nav mark is
18px on 1.75, and each status card gets a 30px tinted chip.

**This is where the reference is wrong, and the difference is worth stating.**
It tints those chips per *card* — orange for one, purple for the next — which is
colour as decoration: the hue tells you which card you are looking at, which the
label already did. E tints them per *state*, out of DESIGN.md §4's four-tone
family: the connection chip is `positive` because the database answered, and
would be `critical` if it had not. Same visual richness, except the colour is
now the fastest-read fact on the card instead of the slowest.

The accent is untouched by this and stays in its four places. A status chip is
not one of them.

### 3. The sidebar — two groups, not one list

The reference's `MAIN MENU` label, its divider, and its `Settings` / `Logout`
pair sitting apart from the destinations above are doing real work: they say the
nav holds two kinds of thing. B ran all five as one list with `Settings` greyed
at the bottom, which made "off" and "different in kind" look like one statement.
Now `Settings` sits below the rule with `Sign out` — which is also the first
home sign-out has had in this shell.

### 4. The measure — content stops growing before the window does

B capped content at 1120px and left it hard against the sidebar: fine at 1440,
wrong at 2560, where the panel keeps growing and the content does not, leaving
one enormous margin on the right. E caps at `--measure` 1100px and **centres**
it, so a wide window gives two even margins. The panel itself still fills — it
is the app's frame, and a frame that stopped at 1100px would put the chrome's
gradient down the middle of a 4K display. The wide shots are the proof.

### Not taken from the reference

Its stat cards are hero metrics: a big number, a tick-mark progress bar, a green
`+12.5% from last period` delta chip. That is 010's banned-defaults item 9
verbatim — and more to the point RePanel has no such numbers. There is no
period, no trend and nothing to compare, so rendering the shape would mean
inventing the data, which is the one thing an admin may never do.

### Measured

```
console-e  light  25 text styles, 0 below AA   tightest 4.65
           dark   25 text styles, 0 below AA   tightest 4.80
overflow          1440, 2560 and 768, both themes: no horizontal scroll
numerals          tabular-nums;  faces Plus Jakarta Sans + Geist Mono
```

## `console-f.html` — the runtime, exactly

The most conservative option on the table, and the alternative to D: **the
console *is* the runtime.** DESIGN.md §1's palette, §2's ladder (and its no-drop-
shadows rule), §3's type, §4's badge language and §6's rhythm, all verbatim; the
sidebar is `features/runtime/sidebar.tsx`'s own anatomy — h-11 head, rule,
grouped nav with micro group labels and 16px marks at 70% opacity, rule, h-11
account block. One palette, one product, no second design language to maintain.
Shots: `shots/console-f-{light,dark}.png` and `-wide-` at 2560x1440.

### The one deviation — the chrome's hue

§1 runs the chrome warm on purpose: hue 78, "so the screen reads as
chrome-vs-content rather than two shades of one grey", against a data surface
that is near-achromatic with a whisper of cool at hue 265. That argument is
about a screen whose content is a dense field of five hundred records — the
warmth is what stops the chrome reading as more table.

The console has no such field. It is four cards and a list on a panel that is
mostly white space, and there the warm chrome stops being a distinction and
becomes the dominant colour of the page, which is what made the first console
concept read as cream paper. So the chrome moves onto the data surface's own hue
family at **half its chroma** — toned down, not recoloured.

```
token               runtime     here       lightness
--sidebar-top       #e7e3de  -> #e2e4e6    .7720 -> .7737
--sidebar-bottom    #dfdbd6  -> #dadcde    .7121 -> .7137
--sidebar-accent    #f7f4f0  -> #f3f4f7    .9077 -> .9047
--sidebar-border    #d5d0ca  -> #cfd1d4    .6352 -> .6362
dark top / bottom   #080605  -> #060608    .0019 -> .0019
                    #040302  -> #030304    .0010 -> .0009
dark accent / border #191714 -> #161719    .0087 -> .0085
                    #2a2622  -> #262729    .0199 -> .0202
```

Every lightness holds to within 0.002, so **§2's ladder is the same ladder and
its measurements are still true**. Only hue and chroma moved: 74 → 265,
.008 → .004. The sidebar's two text tokens move with it at their own lightness,
because a warm text ladder on a cool ground reads as brown rather than as quiet:
`--sidebar-foreground` `#4a443b` → `#434548` (7.44:1 on the new chrome),
`--sidebar-muted` `#665e53` → `#5e5f63` (4.88:1); dark `#bdb7ae` → `#b6b8bc`,
`#8b857d` → `#84868a`.

**The accent is untouched, and is better off.** `--primary` `#bb4d00` is exactly
the runtime's. On a cream chrome it was one warm thing among warm things; on a
cool one it is the only warm thing on the screen, which is what an accent is
for. Spent where §1 and §10 already spend it — the project's mark, and the one
button where there is exactly one thing to go ahead with — and nowhere else.

### What the console adds, because it is a different app

A project switcher in the head block the runtime gives the app's name; two nav
groups (`Project`, `Account`) instead of the definition's, which is the
runtime's own multi-group nav with `Settings` off and `Sign out` housed; and a
1100px measure, centred, because a table wants every pixel and a console does
not.

### Measured

```
console-f  light  21 text styles, 0 below AA   tightest 4.74
           dark   23 text styles, 0 below AA   tightest 4.94
```

Both tightest pairs are the `positive` badge, at exactly the numbers §4 records
for it — which is the check that the palette really is the runtime's, untouched.
No horizontal scroll at 768, 1440 or 2560.

### F against D

| | **D — stock, refined** | **F — the runtime, exactly** |
|---|---|---|
| palette | shadcn's achromatic neutrals | DESIGN.md §1, verbatim but for the chrome's hue |
| accent | none — `--primary` is a weight | `--primary` `#bb4d00`, the runtime's |
| elevation | shadcn's `shadow-sm` | none — §2's hairline-and-lightness, as ruled |
| coherence with the admin | a second, related look | the same look |
| what it costs | five documented deviations from stock | one documented deviation from §1 |

D is a console that looks like good modern SaaS. F is a console that looks like
the product it administers. Neither is wrong; they answer different questions.

