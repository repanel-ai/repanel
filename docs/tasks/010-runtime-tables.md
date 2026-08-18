# Task 010 · Runtime shell + tables — PLAN GATE (design)

## Context
This is the product. The rendered admin is the wedge: it must read as a
carefully designed tool, not a generated database browser (SCOPE.md,
DECISIONS #005). Everything here is driven by the definition fetched from
`/runtime/:projectKey/definition` — nothing hardcoded per resource.

PLAN GATE — a design plan, not code: (1) design tokens — palette as named
hex values for light AND dark, type roles and scale, spacing/density
rationale for data-heavy screens; (2) the signature element that makes a
RePanel admin recognizable (one, not five); (3) treatment specs for: status
badges (enum), relation labels, empty states, loading (skeletons), error
states; (4) an ASCII wireframe of shell + table page. The plan must justify
choices against "operators live in this 8 hours a day" — calm, dense,
legible; restraint over decoration. Wait for approval; screenshots at the
end go to checkpoint C.

## Scope
- `features/runtime/` in apps/web:
  - `use-runtime.ts`: definition query + records query (params: page, size,
    search, sort, filters) with a single cache-key factory.
  - Shell at `/a/:projectKey`: sidebar navigation from definition navigation
    groups (app name, groups, active states), content area, light/dark
    toggle persisted in localStorage.
  - Table page `/a/:projectKey/r/:resourceKey`:
    - columns per definition (relation columns show resolved labels; enum
      values render as the designed status badges; dates humanized with
      exact value on hover; booleans as designed marks, not "true")
    - debounced free-text search; filter bar per definition (enum select,
      boolean toggle, dateRange picker, relation filter — v0 relation filter
      is an id/text input, noted as such); active filters visible and
      clearable
    - column-header sorting for sortable fields; pagination with total
      count; page size selector (25/50/100)
    - URL is the state: search/filters/sort/page live in query params
      (shareable, back-button correct)
    - designed loading skeletons, empty state (differentiates "no records"
      from "no matches — clear filters?"), and error state with retry
  - Row click navigates to the detail route (placeholder page until 011).
- Keyboard: `/` focuses search; table rows reachable by tab; visible focus
  states. Reduced motion respected.
- All styling through the approved token plan (Tailwind theme extension /
  HeroUI theme), no ad-hoc hex values in components.

## Out of scope (binding)
Detail pages (011), actions (012), control plane, per-customer theming,
column resize/reorder/visibility toggles, saved views, export, virtualized
scrolling, mobile-first layouts (must not break at 768px; that is the bar).

## Acceptance
- [ ] Table renders purely from the fixture definition + mocked API in tests
- [ ] Component specs: badge/relation/date cell rendering; filter → query
      key change; URL round-trip of state
- [ ] Manual checklist in summary: light + dark screenshots of shell, table
      with data, empty, loading, error — for checkpoint C review
- [ ] No hardcoded resource/field names anywhere in runtime code

## Allowed dependencies
None new beyond 009's set.
