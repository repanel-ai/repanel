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

Landing as `@theme` values in `packages/ui/src/tokens.css` — the one place tokens
are declared (DECISIONS #028). Dark re-points the same names under `.dark`.

### Surfaces

| token | light | dark |
|---|---|---|
| `--sidebar-top` | `#e7e3de` | `#080605` |
| `--sidebar-bottom` | `#dfdbd6` | `#040302` |
| `--page` | `#f3f1ed` | `#14120f` |
| `--background` (panel) | `#ffffff` | `#1a1a1b` |
| `--card` | `#ffffff` | `#222324` |
| `--muted` (row hover) | `#f2f3f3` | `#2b2b2d` |
| `--accent` | `#eff0f1` | `#2b2b2d` |
| `--secondary` | `#ecedee` | `#2d2e2f` |
| `--sidebar-accent` (active nav) | `#f7f4f0` | `#191714` |

### Text

| token | light | dark |
|---|---|---|
| `--foreground` | `#0a0b0b` | `#f5f6f6` |
| `--muted-foreground` | `#64666a` | `#95979b` |
| `--accent-foreground` | `#191a1b` | `#f5f6f6` |
| `--secondary-foreground` | `#1c1d1e` | `#f3f3f4` |
| `--sidebar-muted` | `#665e53` | `#8b857d` |
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
| `--border` | `#e0e1e3` | `#353537` |
| `--input` | `#dbdcde` | `#3b3c3d` |
| `--ring` | `#a4a5a8` | `#7f8083` |
| `--sidebar-border` | `#d5d0ca` | `#2a2622` |

**Two colour families, on purpose.** The chrome (sidebar, page) is warm — hue 78,
following ref-1, which runs a warm sidebar against a neutral white panel so the
screen reads as chrome-vs-content rather than two shades of one grey. The data
surface is near-achromatic with a whisper of cool — hue 265 at 30% of the
preset's chroma. Lightness values throughout are the preset's own.

`--radius: 0.45rem` (the preset's), with the preset's ramp: `sm .6x`, `md .8x`,
`lg 1x`, `xl 1.4x`.

---

## 2. The dark surface ladder — spec

Four distinct steps, deepest first. Elevation is stated by lightness and a
hairline; **no drop shadows anywhere** — all three references build depth this
way, and the panel shadow was dropped for muddying the edge once the step was real.

| # | surface | dark | step to next |
|---|---|---|---|
| 1 | sidebar (darkest; slight fall top→bottom) | `#080605 → #040302` | 1.081 |
| 2 | page — what the panel floats in | `#14120f` | 1.075 |
| 3 | raised content panel | `#1a1a1b` | 1.231 |
| 4 | row under the cursor | `#2b2b2d` | — |

Light mirrors the ordering with one inversion inherent to light mode: the panel
is the *lightest* surface (`#ffffff`) and the row hover is a **darkening**
(`#f2f3f3`), not a further lift.

| # | surface | light | step to next |
|---|---|---|---|
| 1 | sidebar | `#e7e3de → #dfdbd6` | 1.132 |
| 2 | page | `#f3f1ed` | 1.128 |
| 3 | raised content panel | `#ffffff` | 1.112 (down, to hover) |
| 4 | row under the cursor | `#f2f3f3` | — |

The sidebar's fall is a gradient on the aside; the page is flat. Dark **must**
keep the panel above the sidebar in lightness — shadcn's own `sidebar-inset`
variant puts it below, which reads as recessed and was corrected here.

---

## 3. Type

**Geist** throughout, one family, five sizes.

| token | value | used by |
|---|---|---|
| `--t-micro` | `11.5px` | counts, badges, the `/` hint, the project line |
| `--t-small` | `12.5px` | column headers, page meta, pagination, breadcrumb |
| `--t-body` | `13.5px` | table cells, controls, buttons, account name |
| `--t-title` | `20px` | the page title, and nothing else |
| `--t-nav` | `14px` | nav labels, brand name |
| `--t-nav-meta` | `12px` | group labels, counts, project line, account mail |

The sidebar runs one step above the table deliberately: it is persistent chrome
read at a glance, not dense data. Ref-1's own title-to-nav-label ratio measures
~1.4x; this scale runs 1.43x.

### Tabular numerals — measured, and required

**Geist's default figures are proportional.** Measured at 40px: ten `1`s render
139.2px against ten `0`s at 268.8px. Geist *does* ship a working `tnum` feature —
with `font-variant-numeric: tabular-nums` both measure exactly 240px.

So the build **must** set `font-variant-numeric: tabular-nums` explicitly; the
face will not do it unasked. The approved file sets it once on `body` and every
descendant inherits it (verified on date cells, nav counts, pagination, the
record total and badges). Any component that resets `font-variant-numeric` —
or any future face swap — reintroduces ragged columns silently.

---

## 4. Status badge language

One family: all states share border, padding (`1px 7px`), radius (`--radius-md`)
and size (`--t-micro`). Only fill weight and text colour differ, so no state
shouts louder than its peers.

| state | treatment | light | dark |
|---|---|---|---|
| **Active** — quiet | filled `--secondary`, hairline `--border`, text `--secondary-foreground` | `#ecedee` / `#1c1d1e` | `#2d2e2f` / `#f3f3f4` |
| **Invited** — outlined | transparent fill, hairline `--input`, text `--foreground` | `#dbdcde` edge | `#3b3c3d` edge |
| **Suspended** — tinted | fill `--destructive-soft`, hairline `--destructive-line`, text `--destructive-text` | `#fde6e7` / `#f8b8bb` / `#c2191c` | `#3f2627` / `#683335` / `#ff6467` |

shadcn's stock `destructive` variant is a saturated fill; against outline and
secondary neighbours it made "suspended" the loudest thing on a page where it is
an ordinary state. The light text is `#c2191c` rather than the raw token because
`--destructive` on its own tint measures 4.01:1.

Enum values beyond these three inherit the *quiet* treatment by default. A state
only earns the tinted treatment where the definition marks it as such — the
runtime never guesses severity from a value's spelling.

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
| Sidebar menu item | `h-8 px-2 text-sm` -> 32 / 8 / 14 | 32 / 8 / 14 |
| Sidebar width | `16rem` -> 256 | 236 |
| Table header | `h-10 px-2` -> 40 / 8 | 34 / 10 |
| Table cell | `p-2` -> 8, ~40 row | 36 / 10 |
| Badge | `px-2 py-0.5 text-xs` -> 8 / 2 / 12 | 7 / 1 / 11.5 |
| Inset panel | `m-2 rounded-xl shadow-sm` | `m-2 rounded-xl`, no shadow |
| Nav icons | — | 17px, drawn 24x24 on a 1.5 stroke |

Rhythm tokens: `--h-nav 32px`, `--h-control 32px`, `--h-row 36px`,
`--h-head 34px`, `--h-top 48px`. 18 records visible at 1440x900.

---

## 7. Accessibility floor

Measured from the rendered DOM, both themes, 17 distinct text styles each:
**zero failures**. Tightest passing pair 4.79:1 (dark) / 4.85:1 (light) against a
4.5 requirement. No horizontal overflow at 768px
(`scrollWidth === clientWidth === 768`); the sidebar collapses to a 52px icon
rail. Focus is `--ring` at 3px with a matching border, on every control, nav item
and table row; it is never removed, only restyled.

This floor is a gate, not an aspiration: any token change re-runs the
measurement before it lands.

---

## 8. Navigation icons — pending schema work

The sidebar carries per-resource icons, and they come from the definition.
Assumed field, **not yet in the schema**:

- **`resource.icon`** — optional, one name from a fixed vocabulary.
- **Unknown name** -> validation error listing the whole vocabulary, never
  truncated (#020).
- **Omitted** -> falls back to `table`, so definitions written before the field
  existed still render.
- **Groups get none.** Resources are the navigable items; group labels are
  section headers.
- **Glyphs are drawn in-repo** (#026), 24x24 on a 1.5 stroke. No icon library.

Proposed vocabulary (28): `user users building key shield cart receipt
credit-card package truck tag wallet file folder image book message mail
database webhook terminal activity bell clock calendar settings chart globe
link table`.

A runtime that mapped resource keys to glyphs itself would be the per-resource
hardcoding task 010's acceptance criteria forbid; a free-form icon name would put
a silent missing-glyph state on screen, the failure mode #027 closed everywhere
else. This is `packages/contracts` work (task 001's domain) and needs its own
decision entry — **it is not in 010's scope and is unresolved.**

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

Beyond these five, the direction is approved as specified above. Anything not
stated here is Stage 2's to propose, not to assume.
