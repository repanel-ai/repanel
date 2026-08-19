# Task 009 · Web foundation (two apps + shared UI package)

## Context

The web surface is split by structure, not by lint: `apps/web` is the
console (RePanel's own control plane — login, projects, setup), and
`apps/runtime` is the generated admin renderer (the product's face; all
design investment lands there in 010). `packages/ui` is the shared,
owned component system both consume — shadcn-style copy-in components over
Radix primitives + Tailwind, per the recorded decisions. No HeroUI, no
component library dependency, ever. This task is plumbing: scaffolds,
tokens file, the first few owned components, auth in the console, and a
minimal runtime shell for 010 to build on. No design ambition yet — the
design gate is 010.

## Scope

### 1. `packages/ui` — owned components + tokens

- Package `@repanel/ui`, ESM, browser-only, consumed as TypeScript source
  by both apps (no build step; Vite transpiles workspace source). Strictly
  presentational: components, tokens, icons re-exports. No data fetching,
  no API clients, no app logic — that rule is the package's one sentence.
- `src/tokens.css` — the design-token home: CSS variables for color
  (placeholder neutral palette for now; 010's approved concept replaces the
  values, not the structure), radius, and font stacks. Dark mode via class
  strategy. A shared Tailwind preset (`tailwind-preset.ts`) maps utilities
  onto the variables; both apps extend it.
- First owned components, shadcn-style (copied in, ours, styled only from
  tokens): `Button`, `Input`, `Label`, `Card`, `FormError`. Radix
  primitives underneath where behavior exists (none of these five need
  one yet — but the convention is stated in the package README: interactive
  behavior always sits on Radix; we own pixels, never focus traps).
- Vitest + testing-library set up in the package; one rendering test per
  component (light coverage — they're presentational).

### 2. `apps/web` — the console

- Vite + React + TS, extends tsconfig.base (override module settings as
  Vite requires), Tailwind wired to the shared preset, tokens.css imported.
- Dev server on 5173; proxy `/api` → the API server (strip the prefix or
  configure the client base accordingly — one convention, documented in
  the app README).
- `src/lib/api-client.ts`: single fetch wrapper — base URL,
  `credentials: 'include'`, JSON handling, normalizes the API's
  `{ error: { code, message, details } }` into a typed `ApiError` (shape
  from contracts). All features use it; no raw fetch elsewhere.
- TanStack Query: one QueryClient in the composition root (retry 1, no
  refetchOnWindowFocus).
- react-router: `/login`, `/` (project list placeholder), `/p/:id`
  (placeholder). Placeholder pages are one line each — real screens are 014.
- `features/auth/`: `use-auth.ts` (me/login/logout, single cache-key
  factory), login page built from @repanel/ui components with ApiError
  display, `RequireAuth` wrapper redirecting to /login.

### 3. `apps/runtime` — the renderer shell (minimal)

- Same scaffold shape: Vite (port 5174), Tailwind on the shared preset,
  tokens.css, TanStack Query, react-router.
- Its own small `src/lib/api-client.ts` (same conventions; proxies `/api`
  and `/runtime` to the API server). Duplication with the console's client
  is accepted and deliberate — the two apps' API surfaces will diverge.
- One route: `/a/:projectKey/*` rendering a placeholder that calls
  `GET /auth/me` through the client: signed in → "Runtime shell — built in
  task 010" plus the project key; 401 → a plain message directing to the
  console login (link from a `VITE_CONSOLE_URL` env default
  `http://localhost:5173`). No design, no definition fetching — 010 owns
  all of it.
- Import rule stated in the app README: this app imports only
  `@repanel/ui`, `@repanel/contracts`, and itself.

### 4. Workspace

- Root scripts: `dev:web`, `dev:runtime` (and keep `dev:api`).
- `pnpm -r build && pnpm -r typecheck && pnpm -r test` green across the
  five workspace packages; web tests run on vitest, API stays on jest.

## Out of scope (binding)

Signup UI, any real console screens beyond login (014), any real runtime
rendering (010), design tokens with actual identity (010's gate replaces
the placeholder values), theming, i18n, SSR, state libraries beyond
TanStack Query, shared data hooks in packages/ui, e2e tooling.

## Acceptance

- [ ] Console: login → redirect to /, session persists on reload, logout
      returns to /login (documented manual check)
- [ ] Runtime: signed-in placeholder renders the project key; signed-out
      shows the console-login direction (manual check both, documented)
- [ ] use-auth specs: key factory used for read + invalidate; ApiError
      surfaced on bad credentials
- [ ] api-client spec (console): error normalization; grep in summary shows
      no fetch outside the two api-client files
- [ ] Each @repanel/ui component renders from tokens only — no hex values
      in component files (asserted by grep in summary)
- [ ] Both apps build; workspace-wide typecheck and tests green

## Allowed dependencies

`react`, `react-dom`, `react-router`, `@tanstack/react-query`,
`tailwindcss` + required PostCSS tooling, `vite`, `@vitejs/plugin-react`,
`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
individual `@radix-ui/react-*` primitives as needed,
`vitest` + `@testing-library/react` + `jsdom`. Nothing else.
