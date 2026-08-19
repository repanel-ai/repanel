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
pixel.** None of the five components here need one yet; the first component
that does (dialog, select, dropdown) takes the Radix primitive rather than
hand-rolling the behaviour.

## Tokens

`src/tokens.css` is the design-token home: colour, radius, and font stacks as
CSS variables, mapped onto Tailwind utilities by the same file's `@theme`
block. Components spend tokens (`bg-surface`, `text-muted-foreground`) and
never mint values — there is no hex in a component file, by rule.

Dark mode is the `dark` class on the root element; the dark palette re-points
the same variable names, so no component carries a `dark:` class.

The palette is a deliberate placeholder until task 010's design gate, which
replaces the values without touching the structure.

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
