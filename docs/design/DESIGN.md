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
| `--sidebar-top` | `#e2e4e6` | `#060608` |
| `--sidebar-bottom` | `#dadcde` | `#030304` |
| `--page` (the ground) | = `--sidebar-top` | = `--sidebar-top` |
| `--background` (panel) | `#ffffff` | `#1a1a1b` |
| `--card` | `#ffffff` | `#222324` |
| `--muted` (row hover) | `#f2f3f3` | `#2b2b2d` |
| `--accent` | `#eff0f1` | `#2b2b2d` |
| `--secondary` | `#ecedee` | `#2d2e2f` |
| `--sidebar-accent` (active nav) | `#f3f4f7` | `#161719` |

### Text

| token | light | dark |
|---|---|---|
| `--foreground` | `#0a0b0b` | `#f5f6f6` |
| `--muted-foreground` | `#64666a` | `#95979b` |
| `--accent-foreground` | `#191a1b` | `#f5f6f6` |
| `--secondary-foreground` | `#1c1d1e` | `#f3f3f4` |
| `--sidebar-foreground` | `#434548` | `#b6b8bc` |
| `--sidebar-muted` | `#5e5f63` | `#84868a` |
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
| `--sidebar-border` | `#cfd1d4` | `#262729` |

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
| 1 | the chrome: sidebar **and** the ground the panel floats in | `#060608 → #030304` | `#e2e4e6 → #dadcde` |
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

---

## 3. Type

**Geist** throughout, one family, five sizes.

| token | value | used by |
|---|---|---|
| `--t-micro` | `11.5px` | counts, badges, the `/` hint, the project line |
| `--t-small` | `12.5px` | column headers, page meta, pagination, breadcrumb |
| `--t-body` | `13.5px` | table cells, controls, buttons, account name |
| `--t-title` | `20px` | the page title, and nothing else |
| `--t-brand` | `14px` | the app's name in the sidebar head, and nothing else |
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
| brand | `--t-brand` 14 / 600 | `--foreground` |
| nav item, at rest | `--t-body` 13.5 / 500 | `--sidebar-foreground` |
| nav item, current | `--t-body` 13.5 / 500 | `--accent-foreground` on `--sidebar-accent` |
| group label | `--t-micro` 11.5 / 600, `+0.02em` | `--sidebar-muted` |

A nav item is set at data size because five resource names are something to
scan, not to announce — which also means the type scale is back to five sizes
with the brand above them, rather than six. The group label is smaller *and*
dimmer than what it names, which is the whole of what makes it read as a label.
`--sidebar-foreground` is the token that change needed: the sidebar had one
text colour and two jobs for it.

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

A toast, bottom right, in §4's own two tones — a state that went well and one
that did not are the same kind of object as the badges, told apart the same way.

| tone | fill / hairline / title | used for |
|---|---|---|
| `positive` | `--positive-soft` / `--positive-line` / `--positive-text` | it ran |
| `critical` | `--destructive-soft` / `--destructive-line` / `--destructive-text` | it did not |

Measured on their own tints: title 4.74 / 4.94 positive and 5.12 / 4.79
critical (light / dark), and the description 16.56 / 12.78 — the same numbers
§4 records, because they are the same tokens. Hairlines measure 1.30–1.65
against the fill, inside the band `--border` occupies.

**A success clears itself after five seconds; a failure does not.** A success
is a receipt for something the operator can already see — the badge behind it
has changed — so it may go. A failure carries the only account of what
happened that will ever reach that browser, and something a person has to read
is something they get to dismiss. A success is a `status`; a failure is an
`alert`, which is read out the moment it arrives.

The failure's second line is the API's own message and nothing else. The
runtime writes no sentence about what went wrong upstream of it: it does not
know, and the four categories it is told are exactly what a customer's
application is willing to say through it.

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

**A money field type.** Numbers are set flush right in tabular figures, and that
is all the runtime does with them. It does not read `total_cents` and conclude
that 1240000 is $12,400.00: the name of a column is not a unit, the minor-unit
factor is not two everywhere, and the currency is a fact about the customer's
data that no amount of staring at an integer reveals. Guessing it would put a
wrong price in front of an operator who is about to act on it — the one mistake
an admin may not make. The answer is a schema addition that says the unit out
loud (a `money` field type, or a currency slot on `number`), which is task 001's
domain and a change to a public contract.
