# Task 009 · Web foundation

## Context
`apps/web` hosts two surfaces: the control plane and the generated admin
runtime. This task is plumbing only — the runtime's visual identity is
designed in 010, not here. Follow CLAUDE.md "Frontend architecture" exactly.

## Scope
- Vite + React + TS app `@repanel/web` in the workspace, extending
  tsconfig.base (override module settings as Vite requires). Tailwind +
  HeroUI installed and configured (HeroUI provider, dark mode class
  strategy). Dev proxy: `/api` and `/runtime` → the api server; api base
  path configured accordingly.
- `src/lib/api-client.ts`: single fetch wrapper — base URL, `credentials:
  'include'`, JSON handling, normalizes the API's `{ error: { code,
  message, details } }` into a typed `ApiError`. All features use it.
- TanStack Query: one QueryClient in the composition root; sane defaults
  (retry 1, no refetchOnWindowFocus for now).
- react-router: composition root with routes `/login`, `/` (project list
  placeholder), `/a/:projectKey/*` (runtime placeholder) — placeholders are
  one-line pages; real screens come in 010/014.
- `features/auth/`: `use-auth.ts` (me/login/logout with a cache-key
  factory), login page (HeroUI form, error display), `RequireAuth` route
  wrapper redirecting to /login.
- Minimal app shell: just enough layout to navigate; deliberately unstyled
  beyond HeroUI defaults.

## Out of scope (binding)
Signup UI, the runtime renderer, control-plane screens beyond the login page
and placeholders, design tokens/theming (010), state libraries beyond
TanStack Query, i18n, SSR.

## Acceptance
- [ ] Login → redirected to /, session persists on reload, logout returns
      to /login (documented manual check)
- [ ] use-auth specs: cache key factory used for read + invalidate; ApiError
      surfaced on bad credentials
- [ ] api-client spec: error body normalization
- [ ] No fetch calls outside api-client (grep in summary)

## Allowed dependencies
`react`, `react-dom`, `react-router`, `@tanstack/react-query`,
`@heroui/react`, `framer-motion` (HeroUI peer), `tailwindcss` + its
required PostCSS tooling, `vite`, `@vitejs/plugin-react`,
`@testing-library/react` + `vitest` + `jsdom` (web tests use vitest).
Nothing else.
