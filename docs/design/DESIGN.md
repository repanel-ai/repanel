# RePanel runtime — approved design direction

The record Stage 2 builds from. Approved from concept A2 (`concepts/concept-a2.html`,
screenshots in `concepts/shots/`), which descends from the shadcn preset
`b7Br6PMSh` (`preset-b7Br6PMSh.css`, extracted verbatim) refined against the
reference screenshots in `references/`.

Every value below is measured from the approved file, not restated from memory.
Contrast figures are computed from rendered DOM colours over the first opaque
painted ancestor.

---

## 1. Tokens

Landing in `packages/ui/src/tokens.css` — the one place tokens are declared
(DECISIONS #028). That file is now in three parts, and the split is DECISIONS
#035:

1. **Shared primitives** — the font stacks, the type scale (§3), the rhythm (§6)
   and the radii. Identical on every surface RePanel draws, in every theme. They
   are what makes the console and a customer's admin read as one product, so no
   theme layer may move them.
2. **The colour contract** — every colour name a component may spend, declared
   once as `@theme` values. It holds names rather than paint: each resolves one
   variable deeper, into the `--paint-` value a theme layer sets.
3. **The theme layers** — `.theme-runtime` and `.theme-console`, one root class
   per app, each answering *the whole* of the contract in both themes.

The tables below are the contract, and the values are `.theme-runtime`'s. The
console's layer answers the same contract and spends the same values, with one
exception it makes on purpose — §11 records it, and it is four chrome tokens and
the two sidebar text tokens that go with them.

**A component may reference the contract's names and nothing else.** Nothing
outside `tokens.css` reads a `--paint-` variable, and a layer a component could
reach around would not be a layer. That rule is the whole reason the layers are
worth having: a per-customer theme is a further layer of exactly this shape —
the same names, its own values, applied after these — and it can be, precisely
because no component knows which layer it is standing on.

### Surfaces

| token | light | dark |
|---|---|---|
| `--sidebar-top` | `#f3f3f3` | `#060608` |
| `--sidebar-bottom` | `#f3f3f3` | `#030304` |
| `--page` (the ground) | = `--sidebar-top` | = `--sidebar-top` |
| `--background` (panel) | `#ffffff` | `#1a1a1b` |
| `--card` | `#ffffff` | `#222324` |
| `--muted` (row hover) | `#f2f3f3` | `#2b2b2d` |
| `--accent` | `#eff0f1` | `#2b2b2d` |
| `--secondary` | `#ecedee` | `#2d2e2f` |
| `--sidebar-accent` (active nav) | `#e9e9e9` | `#161719` |

### Text

| token | light | dark |
|---|---|---|
| `--foreground` | `#0a0b0b` | `#f5f6f6` |
| `--muted-foreground` | `#64666a` | `#95979b` |
| `--accent-foreground` | `#191a1b` | `#f5f6f6` |
| `--secondary-foreground` | `#1c1d1e` | `#f3f3f4` |
| `--sidebar-foreground` | `#5a5a5a` | `#9fa1a5` |
| `--sidebar-muted` | `#6b6b6b` | `#7e8084` |
| `--sidebar-strong` | `#111111` | `#f2f3f3` |
| `--utility-foreground` | `var(--foreground)` | `var(--muted-foreground)` |

### Accent, state, edges

| token | light | dark |
|---|---|---|
| `--primary` | `#bb4d00` | `#973c00` |
| `--primary-foreground` | `#fffbeb` | `#fffbeb` |
| `--destructive` | `#e7000b` | `#ff6467` |
| `--destructive-soft` | `#fde6e7` | `#3f2627` |
| `--destructive-line` | `#f8b8bb` | `#683335` |
| `--destructive-text` | `#c2191c` | `#ff6467` |
| `--positive-soft` | `#e4f4e9` | `#1c3125` |
| `--positive-line` | `#b7ddc4` | `#2f5540` |
| `--positive-text` | `#137a3f` | `#46ad72` |
| `--attention-soft` | `#fceedb` | `#3a2a15` |
| `--attention-line` | `#f2cf9e` | `#5e4526` |
| `--attention-text` | `#9a5500` | `#c98c48` |
| `--border` | `#e0e1e3` | `#353537` |
| `--input` | `#dbdcde` | `#3b3c3d` |
| `--ring` | `#a4a5a8` | `#7f8083` |
| `--sidebar-border` | `#dcdcdc` | `#262729` |

**One colour family, and the correction that got there.** This section ran two
for most of the design's life: a warm chrome at hue 78, following ref-1, against
a data surface that was near-achromatic with a whisper of cool at hue 265. The
argument was that a warm sidebar against a neutral panel reads as
chrome-vs-content rather than as two shades of one grey.

**Half of that was right and the wrong half was doing the work.** The
distinction is real and worth keeping; the hue was not what carried it. Task
014b's console proposed a chrome on the data surface's own hue family at half
its chroma, and the two were then rendered on the runtime's own table page and
compared — same page, same layout, six tokens apart. What tells the chrome from
the content in both is **the lightness step and the hairline**: .7737 against
1.0000 in light, .0019 against .0104 in dark, with `--sidebar-border` between
them. The warmth was not adding the distinction, it was adding a temperature —
and on a screen this quiet it was the loudest thing on it. DECISIONS #037.

So the chrome is cool, at hue 265 and chroma .004, and every neutral in this
record is now one family. Lightness values throughout are unchanged, which is
what let the correction be made without re-deciding §2. `--primary` `#bb4d00` is
untouched and is the better for it: it is now the only warm object anywhere in
RePanel, which is what an accent is for.

**Light chrome, flat and achromatic — the second correction. DECISIONS #042.**
The paragraph above closed the *hue* question by finding that the lightness step
and the hairline were doing the work. Taken at its word, that is also an argument
about how much chrome a screen needs: if the step is what separates chrome from
content, the chrome only has to be *a* step below the panel, not a heavy one.
`#e2e4e6` was heavier than it needed to be — a mid grey framing white, with the
chrome reading as the second-loudest thing on the screen after the data.

The chrome in light is now `#f3f3f3`: **one flat value, achromatic, six lightness
points lighter.** Three consequences were priced rather than assumed:

| | before | after |
|---|---|---|
| chrome → panel step | .7737 → 1.0000 | .8963 → 1.0000 |
| `--sidebar-border` | `#cfd1d4`, −6.7 L\* off the chrome | `#dcdcdc`, −8.0 L\* off the chrome |
| `--sidebar-accent` | `#f3f4f7`, +5.7 L\* — lighter than the chrome | `#e9e9e9`, −3.5 L\* — see #043 |

1. **The hairline takes up the slack.** The lightness step halves, so
   `--sidebar-border` is re-derived to sit *further* below the chrome than it did
   — the frame is the half of the pair that still has room to work, and the two
   together carry what the step carried alone.
2. **The active nav item changes direction — see §3 and DECISIONS #043.** This
   first read `#ffffff`, on the argument that `--sidebar-accent` had always been
   the *lighter*-than-chrome token. That was the wrong direction to spend: a
   `#f3f3f3` ground has 4.2 lightness points of headroom above it and 95.8 below,
   and a measured reference spends the plentiful one. The pill is `#e9e9e9`.
3. **The chrome is flat.** The top-to-bottom fall was 2.8 lightness points on a
   90.5 ground; at 95.8 the same proportion is a third of a step, which is a
   gradient nobody can see and one more value a customer layer has to answer.
   `--sidebar-top` and `--sidebar-bottom` stay two tokens and the shells still
   paint a gradient — the fall is available for a value, and this record declines
   it.

**The hue went with it.** `#e2e4e6` carried hue 265 at chroma .004; `#f3f3f3` is
flat grey. That is not a reversal of the paragraph above — that decision moved
the chrome onto the *content's* family, and at this lightness the content's
family is indistinguishable from none. The panel's own neutrals keep their
whisper of cool, because they are read against white rather than against the
chrome. `--primary` is still the only warm object in RePanel.

`--radius: 0.45rem` (the preset's), with the preset's ramp: `sm .6x`, `md .8x`,
`lg 1x`, `xl 1.4x`.

### Light first — the entry theme, and what dark is

**Ruling: light is the entry theme on both surfaces. DECISIONS #035.**

An admin and its console both open light. Nothing about the machine decides it:
the OS preference no longer picks the first visit, and only a stored choice of
dark gets dark. A person who has never expressed a preference is not expressing
one by having a dark editor open.

Dark is not what is left over. It is the ladder §2 specifies, in the numbers the
tables above record, and it is maintained to the same floor §7 sets — measured
in both themes, every time a token moves. What changed is which one arrives
unasked-for, and nothing else. Both themes are named in full in both layers;
both are shot on every checkpoint; the toggle each shell carries is how the
other one is reached, and it remembers.

This reverses nothing about the design and deletes nothing from it. It is a
ruling about a default, made by the founder on real usage, and it is recorded
here because a default is the one design decision every single visitor sees.

---

## 2. The surface ladder — spec

Three distinct steps, deepest first. Elevation is stated by lightness and a
hairline; **no drop shadows anywhere** — all three references build depth this
way, and the panel shadow was dropped for muddying the edge once the step was real.

| # | surface | dark | light |
|---|---|---|---|
| 1 | the chrome: sidebar **and** the ground the panel floats in | `#060608 → #030304` | `#f3f3f3` (flat) |
| 2 | raised content panel | `#1a1a1b` | `#ffffff` |
| 3 | row under the cursor | `#2b2b2d` | `#f2f3f3` |

Light mirrors the ordering with one inversion inherent to light mode: the panel
is the *lightest* surface (`#ffffff`) and the row hover is a **darkening**
(`#f2f3f3`), not a further lift.

**The chrome is one surface, not two.** This started as four steps, with the
page a separate flat tone between the sidebar and the panel. Built, that step
read as a seam down the panel's margin rather than as depth — two greys a hair
apart look like a mistake, not a ladder. So the gradient moved from the
aside to the shell: it now falls across the whole screen, and the sidebar and
the panel's margin are literally the same paint. `--page` is a reference to
`--sidebar-top` rather than a value, so the two cannot drift apart again.

Dark **must** keep the panel above the chrome in lightness — shadcn's own
`sidebar-inset` variant puts it below, which reads as recessed and was
corrected here.

**One shadow exists, and it is spent on what is not on the ladder.** The rule
above is about elevation *within* the page, where a step of lightness and a
hairline say it better than a blur does. A notice is not in the page — it is
over it, briefly, and then gone — so the ladder has no rung to give it. In light
it has no lightness to give either: `--card` and the panel are both `#ffffff`,
so a hairline would be the whole of the edge and a white card on white would
read as a rectangle drawn on the panel rather than as something above it.
`--shadow-lifted` is that one exception, declared once in the contract, and the
toast is the only thing that spends it (DECISIONS #052). Nothing that sits on
the ladder may take it.

---

## 3. Type

**Geist** throughout, one family, five sizes — and the sidebar's own three
outside them.

| token | value | used by |
|---|---|---|
| `--t-micro` | `11.5px` | counts, badges, the `/` hint, group labels |
| `--t-small` | `12.5px` | column headers, page meta, pagination, breadcrumb |
| `--t-body` | `13.5px` | table cells, controls, buttons, the account name |
| `--t-title` | `20px` | the page title, and nothing else |
| `--t-nav` | `14px` | a nav item, and nothing else |
| `--t-brand` | `15px` | the app's name in the sidebar head, and nothing else |
| `--t-nav-meta` | `12px` | the project line, the account mail |

**The sidebar's ladder — corrected.** This section first ran nav labels at 14px
on the argument that the sidebar is chrome read at a glance rather than dense
data. Built, that was wrong in two ways at once, and both were measurable: a
nav item and its group label came out the same colour (`--sidebar-muted` for
both) two pixels apart in size, so the label read as another destination rather
than as the name of a list; and at 14px/400 a list of five resource names read
loose rather than deliberate.

The ladder now has three steps and moves in two dimensions, not one:

| | size / weight | colour |
|---|---|---|
| brand | `--t-brand` 15 / 600 | `--sidebar-strong` |
| account name | `--t-body` 13.5 / 500 | `--sidebar-strong` |
| nav item, current | `--t-nav` 14 / **600** | `--sidebar-strong` on `--sidebar-accent` |
| nav item, hovered | `--t-nav` 14 / 500 | `--sidebar-strong` on `--sidebar-accent` |
| nav item, at rest | `--t-nav` 14 / 500 | `--sidebar-foreground` |
| group label, project key, account mail | `--t-micro` 11.5 / 600, `+0.02em` | `--sidebar-muted` |

A nav item is set at data size because five resource names are something to
scan, not to announce — which also means the type scale is back to five sizes
with the brand above them, rather than six. The group label is smaller *and*
dimmer than what it names, which is the whole of what makes it read as a label.
`--sidebar-foreground` is the token that change needed: the sidebar had one
text colour and two jobs for it.

**And a third rung, because it had two colours and three jobs. DECISIONS #043.**
The table above once ended the ladder on `--foreground` for the brand and
`--accent-foreground` for the current item — *panel* ink, borrowed, because the
chrome had no value of its own that dark. Both are near-black, so the loudest
text on a screen full of records was in the sidebar. The account name was worse
than borrowed: it had no colour class at all and inherited `--foreground` from
`body`, which is how a decision gets made by nobody.

`--sidebar-strong` is that rung, and **it is near-black**:

| | light | L\* | on the chrome |
|---|---|---|---|
| `--sidebar-muted` | `#6b6b6b` | 45.2 | 4.80:1 |
| `--sidebar-foreground` | `#5a5a5a` | 38.2 | 6.22:1 |
| `--sidebar-strong` | `#111111` | 5.1 | 17.02:1 |
| *(the panel's `--foreground`, for scale)* | `#0a0b0b` | 3.0 | — |

**Its first draft was a dark grey, and a measured reference refuted it.** The
rule was that the chrome's darkest ink must stay lighter than the panel's, or
the sidebar competes with the records. The reference sets its current item at
`#0c0c0e` — the panel's ink, near enough — and does not read as competing at
all. The rule was right about the risk and wrong about where it lives: what
would make a sidebar shout is the **quantity** of dark ink, not its value. One
black label among five greys is a focal point; five would be a second table. So
the constraint moves off the colour and onto how many things may wear it — the
current item, the app's name, the account name, and nothing else.

**Pushing the rest of the list back is the other half of the same decision.**
At-rest ink measures L\* 38.1 in the reference against the 29.3 this record had.
Four quieter items are what buy the fifth its black; neither change works alone.
`--sidebar-muted` follows to keep a step under it — the reference uses *no*
colour step there, setting the group label in the same ink as the items and
separating them by size alone, but that is the exact arrangement the paragraph
above records being built here and read as another destination. The step stays.

**Three signals, so each can be quiet.** The current item is carried by the pill,
the ink *and* the weight together. Hover takes the pill and the ink but not the
weight: a route change may reflow a label, a pointer crossing one may not. The
weight is stated once per branch rather than layered as an override, because the
runtime's sidebar joins its class list where the console merges it, and
`font-medium font-semibold` would otherwise leave stylesheet order to decide.

**The glyph is set in its own label's ink.** It was dimmed to 70% on the rule
that the word is what is read and the mark is how the eye finds it. Measured,
that put the resting glyph at an effective `#797979` — *lighter than the group
label that outranks it*, and 3.92:1. A mark harder to see than its word is not
helping anyone find it. The reference dims nothing, and neither does this.

**And the air moved out of the rows and in between them.** The same reference
was measured for rhythm, not just colour: its pill is 159px against a row pitch
of 174, so it holds its label closely — 1.9 ems tall where this record ran 2.2 —
and spends the difference as a **15px gutter between rows**, where this record
had one pixel. A list of five destinations wants to read as five items rather
than as a block, and a gutter says that where a taller row does not.

| | before | after |
|---|---|---|
| nav label | `--t-body` 13.5 | `--t-nav` **14** |
| brand | `--t-brand` 14 | `--t-brand` **15** — it stays a step above the nav |
| row height | `--h-nav` 30 | `--h-nav` **32** |
| between rows | `gap-px`, 1 | `--h-nav-gap` **3** |
| under a group label | `pb-1`, 4 | `pb-2`, **8** |

Half a pixel over the table's is what lets a nav item be picked out at a glance
from the far side of the screen; the sidebar is the one place with the room to
spend it. `--t-nav` is a size of its own rather than a bumped `--t-body` because
the two are answering different questions — a table cell's size is set by how
much of a record fits on a screen, and a nav item's by how fast a destination
can be found. They were the same number by coincidence, not by rule.

### Tabular numerals — measured, and required

**Geist's default figures are proportional.** Measured at 40px: ten `1`s render
139.2px against ten `0`s at 268.8px. Geist *does* ship a working `tnum` feature —
with `font-variant-numeric: tabular-nums` both measure exactly 240px.

So the build **must** set `font-variant-numeric: tabular-nums` explicitly; the
face will not do it unasked. The approved file sets it once on `body` and every
descendant inherits it (verified on date cells, nav counts, pagination, the
record total and badges). Any component that resets `font-variant-numeric` —
or any future face swap — reintroduces ragged columns silently.

### The data face — the trial, and its ruling

**Ruling: one face. Machine-shaped values are set in the sans, and `--font-data`
is hardcoded to `--font-sans` in `tokens.css`.**

BUILD REQUIREMENT 5 asked for both renderings rather than an argument, and both
were built and shot: every 011 surface twice, ids, emails, timestamps, quantities
and JSON blocks included (`shots/record-mono-*.png` against `shots/record-*.png`).
The trial ran on the real screens, and it is decided by usage rather than by the
thing it was proposed for.

The proposal was right about the narrow case and wrong about the page. A mono id
column does scan better in isolation. But `--font-data` is not an id column: it
is every date, every quantity, every email, every reference and every JSON
summary, which on a record page is most of what is on it — and set in a second
family all of that reads as a block of machinery pasted into a document rather
than as the record's own facts. Two families also cost the one thing the type
section is built on: a five-size scale in one family is a ladder an eye can
learn, and the same scale in two is not.

Two of the trial's own findings closed it. The tabular figures above already buy
most of what the mono was wanted for — a column of dates or amounts lines up
exactly, and that was the actual complaint — and the surfaces the id column
argument is strongest on (the record's key, the JSON block) are already set apart
by size, colour and frame, so the face was carrying a distinction that was
already made.

**The mono is documented, not deleted.** `--font-data` stays a token and
`.data-mono` stays in `tokens.css` as a dormant mechanism: adding that one class
to the root swaps every machine-shaped value and changes nothing else, so
reopening the question costs a class name rather than a redesign. It is not a
setting and it is not reachable from the runtime — the temporary dev toggle, its
hook and its storage key are gone. A data face is a decision this record makes
once, not a preference an operator carries.

`--font-mono` itself is still spent: the JSON block's pretty-printed body is
mono because indentation is what it is for.

---

## 4. Status badge language — resolved by the tone map

One family: all states share border, padding (`1px 7px`), radius (`--radius-md`)
and size (`--t-micro`). Only fill and text colour differ, and their contrasts are
matched, so no state shouts louder than its peers.

**The vocabulary is the definition's.** DECISIONS #029 gives an enum field an
optional `tones` map — value → `positive | neutral | attention | critical` — and
those four names *are* the badge's treatments. There is no translation table
between what a customer wrote down and what is drawn.

| tone | fill / hairline / text | light | dark |
|---|---|---|---|
| `neutral`, and every unmapped value | `--secondary` / `--border` / `--secondary-foreground` | `#ecedee` / `#e0e1e3` / `#1c1d1e` | `#2d2e2f` / `#353537` / `#f3f3f4` |
| `positive` | `--positive-soft` / `--positive-line` / `--positive-text` | `#e4f4e9` / `#b7ddc4` / `#137a3f` | `#1c3125` / `#2f5540` / `#46ad72` |
| `attention` | `--attention-soft` / `--attention-line` / `--attention-text` | `#fceedb` / `#f2cf9e` / `#9a5500` | `#3a2a15` / `#5e4526` / `#c98c48` |
| `critical` | `--destructive-soft` / `--destructive-line` / `--destructive-text` | `#fde6e7` / `#f8b8bb` / `#c2191c` | `#3f2627` / `#683335` / `#ff6467` |

Text measured on its own tint: `positive` 4.74 / 4.94, `attention` 5.01 / 4.82,
`critical` 5.12 / 4.79 (light / dark), against a 4.5 requirement. The two new
families are tuned *to* the destructive family's weight rather than to the
maximum available — a positive state reading louder than a critical one would
break the one rule this language has. Their hairlines measure 1.48–2.07 against
the panel, the same band as `--border` (1.31 / 1.42) and `--destructive-line`
(1.67 / 1.75).

shadcn's stock `destructive` variant is a saturated fill; against its
neighbours it made "suspended" the loudest thing on a page where it is an
ordinary state. The light text is `#c2191c` rather than the raw token because
`--destructive` on its own tint measures 4.01:1.

**The outlined treatment is withdrawn.** It was the third of the three this
section first specified — transparent fill, hairline `--input` — and nothing in
the schema can ask for it: #029 fixed the vocabulary at four tones, `neutral`
and unmapped both land on the quiet fill, and a treatment nothing can reach is
not a treatment. It goes the way §8's icon row went.

A state earns a louder tone only where the definition marks it as such. The
runtime never guesses severity from a value's spelling — `suspended` is routine
in one product and an alarm in the next, and `active` can be the alarm.

---

## 5. Signature element — the dotted relation rule

**One signature, applied everywhere a relation appears.**

```css
.relation {
  text-decoration: underline dotted;
  text-decoration-color: var(--muted-foreground);
  text-decoration-thickness: 1px;
  text-underline-offset: 3px;
}
.relation:hover { text-decoration-color: currentColor; }
```

A relation is the one cell whose value belongs to a *different* record. The
dotted rule says so, and says it identically on every surface: **table cells,
detail-view fields, related lists, breadcrumbs, and relation filter values.**
Dotted rather than solid because a solid underline is already spoken for by
links, and the distinction has to survive being seen a thousand times a day.

This is the element that makes a RePanel admin recognisable. It is not
decoration: it is the definition's `relation` field type made visible, and it
must not be applied to anything that is not one.

---

## 6. Component sizing against shadcn

The rule `packages/ui` encodes: **shadcn's `sm` sizes become the default sizes
for controls; the table and badge take their own tighter scale; radii and
component composition are untouched.**

| | shadcn default | approved |
|---|---|---|
| Button | `h-9 px-4` -> 36 / 16 | 32 / 12 |
| Icon button | `size-9` -> 36 | 32 |
| Input | `h-9 px-3` -> 36 / 12 | 32 / 12 |
| Sidebar menu item | `h-8 px-2 text-sm` -> 32 / 8 / 14 | 30 / 8 / 13.5 |
| Sidebar width | `16rem` -> 256 | 236 |
| Table header | `h-10 px-2` -> 40 / 8 | 34 / 10 |
| Table cell | `p-2` -> 8, ~40 row | 36 / 10 |
| Badge | `px-2 py-0.5 text-xs` -> 8 / 2 / 12 | 7 / 1 / 11.5 |
| Inset panel | `m-2 rounded-xl shadow-sm` | `m-2 rounded-xl`, no shadow |
| Toast | `sonner`, an installed dependency | owned; 416 wide, 14 / 12, `--t-body` 13.5, `--radius-xl` |

Rhythm tokens: `--h-nav 30px`, `--h-control 32px`, `--h-row 36px`,
`--h-head 34px`, `--h-top 48px`. 18 records visible at 1440x900.

A list nested inside one record is read in passing rather than worked in, so it
runs one step tighter: `--h-row-compact 30px`, `--h-head-compact 28px`. Nothing
else about it changes — same columns, same type, same gutters — because a second
table that looked like a different component would say the two are different
kinds of thing, and they are not.

A detail field pairs a `--t-small` label with a `--t-body` value on a shared
20px line box and 8px of air, which puts an ordinary field row on the table's
own 36px rhythm and lets a long value grow in whole lines.

**A form sits on that same grid, and stops at 680px.** Reading a record and
editing one are the same page with the values in different clothes, so the two
share one frame: the same label column, the same hairlines, the same rounded
panel — `packages/ui`'s `Fields` and `FormFields` are one grid constant, and a
form whose rows sat on a different one would say the two screens were different
kinds of thing. The row grows, because a `--h-control` 32px input inside 8px of
air is 48px rather than 36px, and that is the one difference: a control is
taller than the value it holds.

`--spacing-form` 680px is the second measure this record has, and §11's argument
for why the runtime never spends the first one is exactly the argument for
spending this one. "A table wants every pixel" is about a field of five hundred
records; a form is the one screen in the runtime that is not one. A line of
typed text has a measure the same way a paragraph does, and an input stretched
across a wide window makes the value harder to read back and the row harder to
scan. It is left against the panel's gutter rather than centred, because every
other runtime screen is.

---

## 7. Accessibility floor

Measured from the rendered DOM, both themes, 17 distinct text styles each:
**zero failures**. Tightest passing pair 4.79:1 (dark) / 4.85:1 (light) against a
4.5 requirement. No horizontal overflow at 768px
(`scrollWidth === clientWidth === 768`); the sidebar narrows to 180px and keeps
its labels, and a table wider than the panel scrolls inside its own frame. (The
52px icon rail this section first specified went with the icons — see §8.) Focus is `--ring` at 3px with a matching border, on every control, nav item
and table row; it is never removed, only restyled.

This floor is a gate, not an aspiration: any token change re-runs the
measurement before it lands.

**Re-run for the cool chrome (DECISIONS #037).** Six tokens moved, so the gate
was measured again on the running app rather than reasoned about: the table page
in both themes at 1440 and at 768 gives **20 text styles light and 22 dark, zero
below AA**, tightest 4.74 light and 4.79 dark — both the `positive`/`critical`
badges, at the numbers §4 records for them, which is what tells you the chrome
change reached nothing it should not have. No horizontal overflow at either
width. The two sidebar text tokens were re-derived at their own lightness for
the same reason the surfaces were: `--sidebar-foreground` measures 7.44:1 on the
new chrome and `--sidebar-muted` 4.88:1.

**Re-run for the light chrome (DECISIONS #042).** Four chrome tokens and the two
sidebar text tokens moved again, and every one of them moved *toward* the floor
rather than away from it: the ground lightened, so text on it gained. Derived on
`#f3f3f3`, `--sidebar-foreground` `#454545` measures **8.64:1** and
`--sidebar-muted` `#5f5f5f` **5.75:1** — up from 7.44 and 4.88. The active nav
label (`--accent-foreground` `#191a1b` on `#ffffff`) measures 17.43:1, and
`--muted-foreground` on the ground, which is what the shell's loading and error
states are set in, gains for the same reason. Nothing inside the panel changed:
the panel is still `#ffffff` and every ratio §4 records is measured against it.
The two tokens were re-derived at their predecessors' own lightness (L\* 29.2 →
29.3, 40.4 → 40.3) so the ladder's *steps* are untouched and only their family
is.

**Re-run for the sidebar's re-derived ladder (DECISIONS #043).** Every rung
moved and one is new, and two of the three moved *toward* the floor rather than
away from it — the rest of the list was pushed back deliberately — so nothing
here is assumed. Each is checked on the chrome **and** on `--sidebar-accent`,
because a nav item sits on the pill and the group label does not.

| | light, on chrome | light, on pill | dark, on chrome | dark, on pill |
|---|---|---|---|---|
| `--sidebar-muted` | 4.80:1 | — | 5.12:1 | — |
| `--sidebar-foreground` | 6.22:1 | 5.68:1 | 7.82:1 | 6.93:1 |
| `--sidebar-strong` | 17.02:1 | 15.55:1 | 18.21:1 | 16.14:1 |

Floor is 4.5 and the tightest pair is `--sidebar-muted` at 4.80:1, which is the
one to watch if it is ever pushed further back. The icons were the real finding:
un-dimmed they now carry their label's own ratio instead of the effective
3.92:1 that `opacity-70` was producing at rest. `--t-nav` at 14px raises every
nav item above the 13.5 the ratios above were measured at, which only helps.
Nothing inside the panel changed.

---

## 8. Navigation is icon-and-text — the deferral, and its reversal

**Ruling: a resource names its own mark. DECISIONS #031.**

This section originally ruled navigation text-first for v0 and recorded the icon
proposal rather than building it, because it is a change to
`packages/contracts` — public product contract, task 001's domain, outside task
010's scope. That deferral did its job: the proposal was written down complete,
it was additive by construction, and landing it later cost a decision entry and
thirty paths rather than a redesign.

It has landed. `resource.icon` is one name from a closed thirty-name
vocabulary — `user users building key shield cart receipt credit-card package
truck tag wallet file folder image book message mail database webhook terminal
activity bell clock calendar settings chart globe link table` — the glyphs are
drawn in-repo (#026) in `packages/ui/src/glyphs.tsx`, an unknown name is
a validation error naming all thirty (#020), and a resource that says nothing
wears `table`. The mark sits at 16px and 70% opacity: a step behind the word,
because the word is what is read and the glyph is how the eye finds it.

**The rule the deferral was built on is untouched, and is the reason the slot
exists: the runtime never maps a resource key to a glyph.** That mapping is
what task 010's acceptance criteria forbid ("no hardcoded resource/field
names"), and it stays forbidden now that the field exists — a resource called
`tbl_cust_01` is pictured by its definition or by nothing.

§6's `Nav icons` row stays withdrawn: the icon takes the item's existing gutter
rather than a column of its own, so nothing in the sizing table moves for it.

## 9. Related records — set apart by the signature that already means it

A record's page holds two kinds of thing: the record's own facts, and lists of
*other* records. Drawn the same way they read as one long page of sections, and
an operator scanning it has to read a heading to know which they are looking at.

The design already has an answer, and it did not need a new one. §5's dotted
rule is the mark for "this belongs to a different record", and it is applied
here at the scale of a whole block rather than a value:

- **Inline**, a related list's heading wears the dotted rule. The record's own
  section titles do not. That is the whole distinction, and it is the same
  distinction the operator already reads a thousand times a day in the cells.
- **Tabbed**, the relationship tabs wear it and `Details` does not.

The rule survives being applied at both scales because it is not decoration:
the block under a dotted heading is exactly the thing a dotted cell points at.
Nothing else changes — same frame, same type, same density — because the
sameness is what makes one difference legible.

### Tabs

A tab is a **link**, not a widget: which panel is open lives in the address, so
it can be linked to, gone back from and reloaded into, exactly as the table's
search and filters are (BUILD REQUIREMENT 1's single-ownership rule, applied to
a screen rather than a filter). That also means no tab-widget keyboard
behaviour is written here — the browser has owned links since it existed.

| | value |
|---|---|
| bar | `--h-head` 34px, hairline `--border` along the bottom |
| tab | `--t-body` 13.5 / 500, 16px gap |
| current | `--foreground`, 2px rule sitting **on** the bar's hairline |
| at rest | `--muted-foreground`, lifting to `--foreground` on hover |

No fill and no accent colour: the current tab is marked on a line the eye is
already following, which is the cheapest mark available and the quietest.

The header — the record's name, its state, its key, and the way back — sits
above the bar and does not move between tabs. It identifies the record, and the
record is the same record on every panel.

## 10. Asking, and answering — the confirmation and the notice

An action is the one thing in this admin that changes a customer's data, and
v0's schema says exactly two things about one: what it is called, and what to
say before running it. The design adds nothing to either.

### The action row

Actions sit on the record's header, opposite the name — the header identifies
the record and does not move between tabs (§9), and neither does what may be
done to it. They are `outline` buttons at the control size, all of them, in the
order the definition lists them.

**No action is drawn as the important one.** Nothing in the schema marks an
action primary or destructive, and reading that out of a label is the same
guess §4 refuses to make about a value's spelling — `Suspend` is routine in one
product and the end of somebody's month in another. A row of equals is the
honest drawing, and the `primary` fill is spent inside the dialog instead,
where there is exactly one thing to go ahead with.

| | value |
|---|---|
| button | `--h-control` 32px, `--t-body` 13.5 / 500, `outline` |
| gap | 8px |

### The dialog

The browser's own `<dialog>`, opened modally. The top layer, the backdrop, the
focus trap, the escape key and making the rest of the page inert are all things
the platform does correctly, and none of them is written here — measured on the
built page, `:modal` is true, so the record behind really is inert. What is
written here is what it looks like.

| | value |
|---|---|
| surface | `--card` — the step above the panel |
| width | 416px (`min(26rem, 100vw - 2rem)`) |
| radius | `--radius-xl` 10.08px, matching the panel's own |
| title | `--t-body` 13.5 / 500, `--foreground` |
| body | `--t-body` 13.5, `--muted-foreground` — the definition's `confirm`, verbatim |
| backdrop | `#000` at 45% |
| answers | `Cancel` (`outline`), then the action's own label (`primary`) |

The confirm button wears the action's label rather than a generic `Confirm`, so
the button that was pressed and the button that goes ahead say the same word.
The heading does too: the whole dialog is one sentence with the author's
warning in the middle of it.

`--card` is the surface because it is already the ladder's step above the panel
— in dark it measures 0.0063 of relative luminance above it. In light both are
`#ffffff` and the backdrop is what makes the step, which is what a scrim is
for; the hairline is `--border` in both.

Two refusals, both deliberate. A click on the backdrop dismisses nothing: a
stray click is not an answer to a question about somebody's data. And once the
request is out, escape stops cancelling and both buttons disable, because there
is nothing left to cancel — the dialog says `Running…` in `--t-small`
`--muted-foreground` and waits.

### The notice

A toast, top right, in §4's own tones — a state that went well and one that did
not are the same kind of object as the badges, told apart the same way. It is
RePanel's own component (`packages/ui/src/toast.tsx`) rather than an installed
one, which is why its corner, its stack and its clocks are specified here
instead of inherited.

**It moved from bottom right to top right, and it clears the topbar.** Both of
RePanel's shells put the same chrome in the panel's top-right corner — a theme
toggle, and either `Refresh` or the way out — so the stack begins under the bar
and inside the panel's own gutter rather than over it. A notice landing on a
control is a control nobody can press for as long as the notice is up.

**The tone is ink, not paint.** Every notice is the same surface — `--card`,
`--border`, and §2's one shadow under it — and what differs is the mark and the
title. A tinted block floating over a data panel reads as a coloured hole in the
page rather than as something above it, and the fills were doing that job badly
in exchange for the contrast they cost (DECISIONS #052).

| tone | mark | title | used for |
|---|---|---|---|
| `positive` | check | `--positive-text` | it ran |
| `critical` | alert | `--destructive-text` | it did not |
| `neutral` | info | `--secondary-foreground` | neither |

| | value |
|---|---|
| corner | top right — `--spacing-top` + 16px down, 16px in |
| surface | `--card`, `--border` hairline, `--shadow-lifted` |
| width | 416px (`min(26rem, 100vw - 2rem)`), the dialog's own |
| radius | `--radius-xl` 10.08px, the dialog's and the panel's |
| padding | 14 / 12 |
| gap between notices | 8px |
| mark | 16px, in the title's own colour |
| title | `--t-body` 13.5 / 500, the tone's own text colour |
| description | `--t-body` 13.5, `--foreground` |
| at most | three, newest on top; a fourth takes the oldest's place |
| clears itself | `positive` and `neutral` 4s, `critical` 8s |
| leaves over | `--motion-fast` 120ms, back down the 4px it came up |

Measured off the running app, both themes, on the shots below (light / dark):
title **5.41 / 5.61** positive, **6.09 / 5.45** critical and **16.88 / 14.20**
neutral; description **19.71 / 14.54**; hairline 1.31 / 1.29. Every one of them
is better than the tinted version it replaced — a tint is a step toward the ink
that sits on it, and taking it away gives that ink the whole of the card.

**Every notice clears itself now, and 012's failure that never did is
reversed.** This section first ruled that a success goes after five seconds and
a failure stays until it is dismissed, on the grounds that something a person
has to read is something they get to dismiss. They still get to — every notice
carries its own dismiss — but the stack is bounded at three, and a notice with
no clock on it holds one of those three against every notice after it. So a
failure is given twice a success's time rather than none.

**Pointing at the stack, or tabbing into it, stops every clock in it**, and
letting go resumes what was left rather than restarting. That is what makes the
shorter failure honest: its eight seconds are eight seconds of nobody reading
it.

**The mark says which before the colour does.** A check, an alert triangle and
an info disc, 16px, in the title's own colour — so the tone is a second signal
rather than the only one (§7). With the fills gone the mark is carrying more
than it used to, which is the right thing to be carrying it: a shape is legible
to a reader a colour is not.

**A success is a `status` and a failure is an `alert`**, which is read out the
moment it arrives. The stack itself is a `region` labelled `Notices`, so a
notice still up is something a screen reader can go back to.

The failure's second line is the API's own message and nothing else. The runtime
writes no sentence about what went wrong upstream of it: it does not know, and
the four categories it is told are exactly what a customer's application is
willing to say through it.

**One exception, and it is about RePanel rather than about the customer.** When
the application refuses a call the way it refuses one it cannot verify — a 401
or a 403, named in that sentence — the notice gains a second, quieter line:

> If running locally: set the dev action secret printed at repanel dev's boot.

Every outbound action is signed (`docs/SIGNING.md`), `repanel dev` generates
that secret per run and prints it at boot, and an application that has not been
given it answers in exactly this way. The line says *if* because the runtime
cannot know where it is running: `repanel dev` serves the same bundle the hosted
product serves (DECISIONS #048).

---

## 11. The console — the same product, on its own layer

Task 014b. `apps/web` is RePanel's control plane and `apps/runtime` is what it
sets up, and for a customer's developer they are one thing seen twice. So the
console is drawn from this record and not from a second one: §1's palette, §2's
ladder **and its no-drop-shadows rule**, §3's type, §4's badge language, §6's
rhythm to the pixel, and the sidebar anatomy `features/runtime/sidebar.tsx`
already has — an h-11 head block, a rule, grouped nav with micro group labels
and 16px marks at 70% opacity, a rule, an h-11 account block pinned to the
bottom.

Selected from concept F (`concepts/console-f.html`), shot in
`shots/console-014b/`.

### The chrome this surface proposed, and both layers now share

For one commit the console was the only layer running a cool chrome, and this
section recorded it as a deviation. It is not one any more: §1 took it, and the
two layers hold the same values to the digit. What is worth keeping is *why the
console found it* — the reasoning is about which surface a rule was written for,
and that question will come up again.

§1's chrome ran warm so a screen whose content is a dense field of five hundred
records would read as chrome-vs-content rather than as two shades of one grey.
**That argument is about the field.** A console screen is three cards and a list
on a panel that is mostly white space, so there was nothing for the chrome to be
told apart from, and the warmth stopped being a distinction and became the
page's dominant colour — which is exactly what got the first console concept
rejected. The proposal moved the chrome onto the data surface's own hue family
at half its chroma (hue 74 → 265, chroma .008 → .004) and changed nothing else:

| token | was | is | luminance |
|---|---|---|---|
| `--sidebar-top` | `#e7e3de` | `#e2e4e6` | .7720 → .7737 |
| `--sidebar-bottom` | `#dfdbd6` | `#dadcde` | .7121 → .7137 |
| `--sidebar-accent` | `#f7f4f0` | `#f3f4f7` | .9077 → .9047 |
| `--sidebar-border` | `#d5d0ca` | `#cfd1d4` | .6352 → .6362 |
| `--sidebar-foreground` | `#4a443b` | `#434548` | .0591 → .0592 |
| `--sidebar-muted` | `#665e53` | `#5e5f63` | .1145 → .1146 |

Those are the values as of #037. All six moved again under #042 — the light
chrome — on both layers at once; §1 carries the current numbers.
| `--sidebar-top` (dark) | `#080605` | `#060608` | .0019 → .0019 |
| `--sidebar-bottom` (dark) | `#040302` | `#030304` | .0010 → .0009 |
| `--sidebar-accent` (dark) | `#191714` | `#161719` | .0087 → .0085 |
| `--sidebar-border` (dark) | `#2a2622` | `#262729` | .0199 → .0202 |
| `--sidebar-foreground` (dark) | `#bdb7ae` | `#b6b8bc` | .4774 → .4786 |
| `--sidebar-muted` (dark) | `#8b857d` | `#84868a` | .2374 → .2379 |

**Every lightness holds to within 0.002, which is the whole reason this could be
taken back to the runtime at all** — §2's ladder is the same ladder and its
measurements never needed re-deriving. Only hue and chroma moved. The two text
tokens move with the surface they are read on, because a warm text ladder over a
cool ground reads as brown rather than as quiet.

Then the same six tokens were rendered on the runtime's own table page, warm and
cool, and the cool one did not lose the chrome-vs-content distinction the warmth
was supposed to be carrying — the lightness step and the hairline were carrying
it all along. §1 records the correction; DECISIONS #037 records the decision.
`shots/console-014b/runtime-chrome-{warm,cool}-{light,dark}.png` is what it was
made from.

### Three structural additions, because a console is a different app

**A project switcher** in the head block the runtime gives the app's name. A
console is always inside one project out of several, so that slot is the way
back to the list that chooses between them, rather than a label.

**Two nav groups instead of the definition's.** `Project` names the four pages —
Overview, Connection, Agent access, Definition — and `Account` names the pair
that is about the person rather than the project. That is the runtime's own
multi-group nav, filled from a fixed list instead of a definition. `Settings` is
drawn and switched off: project rename and delete are task 014's binding
out-of-scope, and a nav that hides what does not exist yet teaches the wrong
shape of the product, where one that shows it off says "later", which is true.

**A measure.** Console content caps at `--spacing-measure` 1100px and is centred
in the panel; the panel itself keeps filling the window, because it is the app's
frame. The runtime never spends this — a table wants every pixel — and a console
does: left against the sidebar, a 2560px window gives one enormous margin
instead of two even ones.

### Which page you are on lives in the address

`/p/:id/overview | connection | agents | definition`, and `/p/:id` redirects to
the first. Same rule §9 keeps for a record's tabs and BUILD REQUIREMENT 1 keeps
for a table's filters: a screen that can be linked to, gone back from and
reloaded into. Task 014's single scrolling column could do none of those, and a
person in a console is *somewhere*.

Overview is the only page that is new, and it holds nothing the other three do
not already fetch: the connection, the token list and the definition status.
The setup checklist is **derived on every render** from those three answers
rather than stored, so it cannot drift from them, and it asks the API nothing of
its own.

### Measured, from the rendered DOM

```
contrast   light  21 distinct text styles, 0 below AA   tightest 4.74
           dark   23 distinct text styles, 0 below AA   tightest 4.94
           (the tightest pair in both is the `positive` badge, at exactly the
            numbers §4 records for it — which is the check that the palette
            really is the runtime's, untouched)

overflow   no horizontal scroll at 768, 1440 or 2560, both themes
numerals   tabular-nums at the root; faces self-hosted Geist + Geist Mono
```

---

## 12. Motion — two durations, one easing, and a list that is closed

**Ruling: RePanel has a motion vocabulary of two durations and one curve, it is
spent only on the list below, and data surfaces are banned from it outright.
DECISIONS #041.**

The vocabulary was not absent before this section; it was borrowed and
unwritten. Every `transition-colors` in the product resolved its duration from
Tailwind's `--default-transition-duration`, which is 150ms on
`cubic-bezier(0.4, 0, 0.2, 1)` — an ease-*in*-out, so a hover started slowly,
which is the one thing a hover may not do. Nothing chose that. It was the
default of a library, applied to a product whose entire argument is that an
operator's eye is the scarce resource.

### The vocabulary

| token | value | what it is for |
|---|---|---|
| `--motion-fast` | `120ms` | a colour changing under a pointer, or under a keyboard |
| `--motion-base` | `180ms` | a surface arriving that was not on the screen a moment ago |
| `--motion-ease` | `cubic-bezier(0, 0, 0.2, 1)` | all of it, always |

Three values, and there is no fourth. `--motion-fast` and `--motion-base` are
the only durations, and nothing is slower than `--motion-base`: 180ms is the
outer edge of a step that still reads as the same gesture as the click that
caused it. The curve is an ease-out and only an ease-out — motion leaves at
speed and settles, and nothing in RePanel eases *in*, because a thing that
starts slowly is a thing that has not answered yet. The value is the standard
decelerate, taken rather than invented: it is what Tailwind's own `ease-out`
holds. What is ours is that there is exactly one of them, under a name, so a
review can grep for anything else.

`tokens.css` also answers Tailwind's own `--default-transition-duration` and
`--default-transition-timing-function` with these, so a bare `transition-colors`
written anywhere lands on the vocabulary rather than back on the library's
default. Spending a step by name (`duration-base`) is for the one case that is
not fast.

### The list, and it is closed

Motion appears in these places and nowhere else:

| what | step | what moves |
|---|---|---|
| hover, focus, and the active nav row | fast | colour only — text, background, border, underline |
| the dialog, and its backdrop | base | fade up over 4px; the backdrop fades |
| the date-range popover | base | fade up over 4px |
| a dropdown, when RePanel owns one | base | the same enter, by the same rule |
| a form | base | fade up over 4px |
| a toast arriving | base | fade up over 4px |
| a toast leaving | fast | fade back down over the same 4px |
| the stack closing over a notice that has gone | — | nothing moves; it is instant |
| the theme toggle | fast | the colours of the whole screen cross |
| a checklist step turning done | fast | the mark's and the title's colour |

**A form is a surface, not a data surface, and that is why it is on this list.**
Task 027 added the only row this section has gained since it was written, and
the rule it has to answer is the one below it: a record does not fade onto its
page, and a table row does not move at all. A form is neither. The ban is an
argument about *reading* — an operator reads a value under time pressure and
then acts on it, so motion there delays the value and pulls the eye to the
change instead of to what it now says. Nobody reads a form under time pressure;
they arrive at it having decided to change something, and there is no value on
it yet to be delayed. What the enter buys is the one thing the ban costs
nothing to keep: a screen that is now asking for input rather than showing
records says so before the first character is typed.

It is the same 180ms, the same ease-out and the same four pixels every other
arriving surface spends, applied to the form's own frame — the panel of fields
and the two answers under it — and to nothing else on the screen. **Submitting
is instant**, and so is the record the write lands on: the write is a data
event, and the record it produces is a data surface, both of them squarely
inside the ban. DECISIONS #057.

**Enters only, and a notice is the one thing that also leaves.** A dialog and a
popover arrive and do not go: an exit there is time an operator spends watching
something they have already finished with, and the answer to "I am done with
this" is for it to be gone. That rule stands, and it stands for the same reason
it always did.

A notice is not that, and the difference is who ended it. A dialog closes
because somebody closed it, and they are already looking at what was behind it.
A notice mostly ends **on its own clock, without anybody asking** — and a thing
that vanishes unbidden, between two frames, reads as a glitch rather than as an
ending. The 120ms it takes to go is not time spent waiting; it is the only
signal that something ended rather than broke. DECISIONS #052.

It is bounded to keep it honest: `--motion-fast`, the shorter of the two steps,
because leaving is quicker than arriving; the same single ease-out; and the
exact reverse of the enter, so the two are one gesture and its undo rather than
two ideas. **The stack does not animate closed** — the notice holds its place
until it has gone, and the ones under it come up instantly, because that is
layout and layout is still banned from motion.

**A dropdown has no owned implementation today.** RePanel's only dropdown is a
real `<select>`, whose popup the browser draws and the browser animates. The row
is in the table so that the day an owned menu is built, what it does is already
decided rather than invented.

**Anything not in that table does not move.** The list is closed in the strict
sense: a new place for motion is a change to this section and a decision entry,
not a judgement call at a call site. That is what makes the rule reviewable —
one grep over the source returns the whole of RePanel's motion, and every line
it returns should be traceable to a row above:

```
grep -rn "animate-\|transition-\|duration-\|ease-" --include='*.tsx' apps packages
```

### Data surfaces are banned from motion

**A table row, a sort, a filter, a page change and a record load are instant.**
Not fast — instant. No row fades in, no row transitions its hover highlight, the
table does not animate when a column is sorted or a filter narrows it, a record
does not fade onto its page, and a skeleton does not pulse.

The reason is not taste. An admin is a place where somebody reads a value and
then acts on it, and the read is under time pressure in exactly the moments that
matter most. Motion on data costs twice: it delays the value by however long the
step lasts, and — worse — it draws the eye to the fact that something changed
instead of to what it now says. A 200-row table whose rows each animate their
hover is a surface that shimmers as a pointer crosses it. The operator did not
ask a question about the pointer.

It also protects the one thing motion is genuinely good at. Because nothing in
the data panel ever moves, a toast rising in the corner is unmistakably *an
event* rather than the screen breathing. Motion is a scarce signal here, and it
is spent on things that happened rather than on things that are.

Three things were removed to make this true rather than declared: the table
row's `transition-colors`, the skeleton's `animate-pulse`, and the JSON block's
rotating chevron. Each was a library default nobody had ruled on.

**The theme swap is the single exception, and it is bounded.** A theme belongs
to the whole screen rather than to anything on it, so a crossfade that stopped
at the edge of the data panel would be half a screen changing at 120ms beside
half a screen snapping — which is worse than either alone. `useTheme` marks the
document immediately before the class flips and takes the mark off once the fast
step has run; outside that window the rule matches nothing, and the row under a
pointer is as instant as this section says. It is written down as an exception
because that is what it is.

### Reduced motion takes all of it away

`prefers-reduced-motion: reduce` collapses every value above to `0ms`, and it is
answered twice on purpose, because the two halves reach different things:

1. **The vocabulary collapses.** `--motion-fast` and `--motion-base` are
   redeclared as `0ms` at the root, which empties every token that spends them —
   including the dialog backdrop's fade, which lives on `::backdrop` and which a
   universal selector cannot address.
2. **The blanket reset stays.** `*`, `*::before` and `*::after` get
   `animation-duration: 0ms`, `transition-duration: 0ms` and
   `scroll-behavior: auto`, all `!important`, which catches anything that never
   asked the vocabulary for a number.

**It takes the movement and leaves the function.** A notice clears itself on a
timer rather than on the end of its animation, so both halves above can collapse
to `0ms` and a toast still goes when it is done — reduced motion is not reduced
function, and somebody who asked their machine for less movement did not ask for
a corner that fills up (§10). The exit is asked about rather than assumed: where
reduced motion is set there is no 120ms to sit through, so a dismissed notice
goes at once instead of holding a place for an animation that is not playing.

The rule predates this section and, until it, had almost nothing to collapse.
It has something to collapse now, which is the point at which it had to be
checked rather than assumed.

---

## BUILD REQUIREMENTS

Conditions carried from direction approval. Each is binding on Stage 2.

1. **Single ownership of filter state.** The filter triggers show their values;
   the separate chip row is removed. `Clear all` stays as the only control that
   speaks for the filter set as a whole. No value appears in two places.

2. **The table footer docks to the last row.** Table and footer are one bounded
   object: the footer is the last element inside the frame, so with four rows it
   meets row four and with a full page it sits at the bottom of a scrolling
   frame. There is never dead space between the final row and the footer.
   *(Verified: the gap measures 0px at four rows.)*

3. **Utility controls sit one step quieter than data in dark.** Refresh, the
   theme toggle and comparable chrome take `--utility-foreground`, which resolves
   to `--muted-foreground` in dark and `--foreground` in light, lifting to
   `--foreground` on hover. Data is never outshone by the controls framing it.

4. **Tabular numerals everywhere data repeats.** Geist's default figures are
   proportional (measured in §3), so `font-variant-numeric: tabular-nums` is set
   once at the root and no component may reset it. Applies to every column of
   dates, ids, counts, amounts, pagination ranges and nav counts.

5. **A mono / semi-mono data-face variant for dates and ids, shown at checkpoint
   C.** Build the table so the face used for machine-shaped values (dates,
   primary keys, references) is a token, not a hardcoded family, and bring both
   the single-face and the mono-variant renderings to checkpoint C for a
   decision. The exploration behind this is real: a monospace data voice tested
   markedly better for scanning id and email columns than a single face did.

   *Met, and ruled: the sans. Both renderings were built and shot; §3 records
   the ruling and what closed it.*

Beyond these five, the direction is approved as specified above. Anything not
stated here is Stage 2's to propose, not to assume.

---

## Open items

Questions this record has not answered. Each is additive by construction — the
runtime's behaviour today is what happens while the answer is absent — and each
needs its own decision entry before it is built.

**Whether the notice's corner is the right corner.** §10 puts the stack at the
top right of the panel, clear of the topbar. The record header's action row is
right there too (§10's own action row rule), so for as long as a notice is up it
covers the buttons it is a notice about — visible in `toast-stacked-*` below,
and worst on a failure, where the control an operator would retry with is the
one under the notice.

*Task 027 made this worse and is the reason it is now worth answering.* The
action row could previously be empty — an action is drawn only where the record
meets its precondition, and a record with nothing left to do to it wears no row
at all — so the collision was occasional. `Edit` is on that row whenever the
resource takes changes, whatever state the record is in, and a create lands on
the record it made with a notice about it. So the first thing an operator sees
after making a record is a notice sitting on the one control that screen offers:
`shots/forms-027/form-success-light.png`. Three corners are already spoken for: the topbar's chrome
is above, the breadcrumb is top left, and `repanel dev`'s problems overlay is
bottom left. Bottom right — where 012 put it — is the only corner nothing else
claims. The answer is a placement ruling, not a component change: the stack is
one class either way.

**A money field type.** Numbers are set flush right in tabular figures, and that
is all the runtime does with them. It does not read `total_cents` and conclude
that 1240000 is $12,400.00: the name of a column is not a unit, the minor-unit
factor is not two everywhere, and the currency is a fact about the customer's
data that no amount of staring at an integer reveals. Guessing it would put a
wrong price in front of an operator who is about to act on it — the one mistake
an admin may not make. The answer is a schema addition that says the unit out
loud (a `money` field type, or a currency slot on `number`), which is task 001's
domain and a change to a public contract.
