import type { Action, RecordValue, VisibleWhen } from "@repanel/contracts";

/**
 * Which of a resource's actions this record is worth being offered.
 *
 * The definition's `visibleWhen` is read against the values already on screen —
 * an action whose precondition does not hold is not drawn, so an operator is
 * never handed a button whose only answer is a refusal.
 *
 * This is the admin being honest about what it knows, and nothing more. The
 * rule itself lives where it is enforced: a `dbUpdate` is guarded by validation
 * and by the column it writes, an `httpCall` by the customer's own endpoint,
 * and both still refuse a request this never drew (DECISIONS #027 — the
 * refusal stays, whatever the screen showed).
 */
export function visibleActions(
  actions: readonly Action[],
  values: Record<string, RecordValue>,
): Action[] {
  return actions.filter(
    (action) => !action.visibleWhen || holds(action.visibleWhen, values[action.visibleWhen.field]),
  );
}

/**
 * Validation has already established that exactly one condition is stated. A
 * definition stored before that rule — or one that somehow says neither — is
 * read as saying nothing, and something that says nothing hides nothing.
 */
function holds(condition: VisibleWhen, value: RecordValue | undefined): boolean {
  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.isSet) return hasValue(value);
  return true;
}

/**
 * Whether the record holds anything here. A relation says its own nothing as
 * `{ id: null }` rather than as `null`, which is a shape on the wire and not a
 * second kind of emptiness.
 */
function hasValue(value: RecordValue | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "object" && !Array.isArray(value) && "id" in value) return value.id !== null;
  return true;
}
