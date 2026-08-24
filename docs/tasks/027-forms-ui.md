# Task 027 · Forms II: runtime UI

## Context
The operator-facing half of 026, to the design system's standard —
forms are where admin UIs usually get ugly; ours doesn't.

## Scope
- Create + edit forms rendered from the definition: per-type inputs
  (mono where the data face rules say), enum selects with tones on the
  current value, date/dateTime with the token-styled inputs (from the
  checkpoint-C ride-along), relation-by-id v1 (labeled lookup is a
  known limitation), required/nullable affordances, em-dash-to-input
  for nullable edit.
- Server errors (the #008 shape) render inline at the field via the
  path; unknown errors at form level, sanitized.
- Entry points: an Edit action on detail (only when the resource opts
  in), New on the table header (create-capable only). Motion per §12:
  form appears with base enter; submits are instant.
- Invalidation: record + list keys on success (the #033 lesson).

## Out of scope (binding)
Everything 026 excluded; autosave; dirty-state route guards beyond a
plain confirm; keyboard-shortcut schemes.

## Acceptance
- [ ] Crewbase's editable resource: create + edit fully via UI, dark +
      light screenshots (form, field error, success)
- [ ] A validation error from the server lands on the exact field
- [ ] Non-editable resources show no forms surface anywhere

## Allowed dependencies
None new (owned components; extend packages/ui as needed).
