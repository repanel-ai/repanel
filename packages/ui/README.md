# @repanel/ui

The component system both RePanel frontends are built from — the console
(`apps/web`) and the runtime renderer (`apps/runtime`).

**This package is strictly presentational.** No data fetching, no API clients,
no application logic ever lives here.

## Owned, not installed

Components are copied in and owned outright (shadcn-style), not pulled from a
component library. The runtime's look is the product, and its stability is a
promise we cannot make on top of someone else's release schedule
(`docs/DECISIONS.md` #026).

The line is drawn at behaviour: **interactive behaviour always sits on Radix
primitives — focus traps, roving tabindex, ARIA wiring — and we own every
pixel.** Nothing here has needed one yet, and twice that has been checked rather
than assumed. The dialog takes the browser's own `<dialog>`, which owns the top
layer, the backdrop, the focus trap and the escape key. The toast owns a stack,
three clocks and a hover that pauses them, and manages no focus at all — there
is nothing to trap and no roving anything, so a primitive would be a dependency
bought for its ARIA and given none of it to do. The first component that really
needs one — a dropdown, a combobox — takes the Radix primitive rather than
hand-rolling the behaviour.

## Tokens

`src/tokens.css` is the design-token home, in three parts (`docs/DECISIONS.md`
#035, `docs/design/DESIGN.md` §1):

1. **Shared primitives** — font stacks, the type scale, the rhythm, the radii.
   The same on every surface RePanel draws, in every theme.
2. **The colour contract** — every colour name a component may spend, declared
   once as `@theme` values so Tailwind mints the utilities. It holds names, not
   paint: each resolves one variable deeper, into a `--paint-` value.
3. **The theme layers** — `.theme-runtime` and `.theme-console`, one root class
   per app, each answering the whole contract in both themes.

Components spend the contract's names (`bg-card`, `text-muted-foreground`) and
never mint values — there is no hex in a component file, by rule, and no
component reads a `--paint-` variable. That is what lets a per-customer theme be
one more layer of the same shape rather than a fork.

Dark mode is the `dark` class on the root element, beside the layer's own class;
the layer re-points the same names, so no component carries a `dark:` class.
**Light is the entry theme** on both apps: only a stored choice of dark gets
dark, and the OS preference does not decide it.

## Consuming it

The package is TypeScript source — there is no build step; each app's Vite
transpiles it.

```ts
import { Button, Card, FormError, Input, Label } from "@repanel/ui";
```

```css
/* the app's CSS entry */
@import "@repanel/ui/tokens.css";
@source "../../../packages/ui/src";
```

The `@source` line is not optional: Tailwind scans the importing app for class
names, and these components live outside it.
