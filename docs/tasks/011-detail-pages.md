# Task 011 · Runtime detail pages

## Context
Extends the approved 010 design system to record detail. An operator opens a
record to understand it before acting: identity, status, sections, related
records. Same law: rendered purely from the definition.

## Scope
- Route `/a/:projectKey/r/:resourceKey/:id`:
  - header: record label (labelField value), primary-key subtly available
    (copyable), enum status badge if the resource has an enum field marked
    in the detail header — v0 heuristic: first enum field in the first
    section; note this heuristic in the summary for a future schema slot
  - sections per definition: two-column field grid (label + value),
    per-type renderers: longText preserved whitespace, json in a collapsed
    read-only tree/pretty block, email/url as safe links (rel noopener),
    relation as a link to the target record, dates humanized + exact,
    hidden fields shown here (per 008 semantics), null/empty rendered as a
    designed em-dash treatment — never blank cells
  - related lists per definition: compact paginated tables (reuse 010 table
    internals at smaller density), each row linking to its record
  - breadcrumb back to the resource table preserving the URL state the
    operator came from
- `use-runtime.ts` grows record + related queries via the same key factory.
- Loading skeleton mirrors the final layout; error and not-found states
  designed, with a path back.

## Out of scope (binding)
Actions UI (012), editing anything, activity/audit info, JSON editing,
file previews, printing, cross-record navigation (next/prev).

## Acceptance
- [ ] Renders every fixture field type correctly (spec per renderer)
- [ ] hidden shown in detail, sensitive absent (asserted against mocked API)
- [ ] Related list pagination works and links correctly
- [ ] Back preserves table state (spec on the breadcrumb link)

## Allowed dependencies
None new.
