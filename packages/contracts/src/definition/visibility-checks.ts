import type { VisibleWhen } from "./actions.js";
import { formatList, type ValidationError } from "./errors.js";
import { sensitiveFieldError, unknownField, type FieldEntry } from "./reference-errors.js";
import type { Resource } from "./schema.js";

/**
 * An action's precondition names a field of its own resource, says exactly one
 * thing about it, and says something that value could be.
 *
 * `hidden` is deliberately allowed: a precondition reads a value, it never
 * renders one, and DECISIONS #014 keeps `hidden` a display choice rather than a
 * second security flag. `sensitive` is refused for the reason #014 refuses a
 * filter — whether a button is drawn is an answer about the secret, given one
 * record at a time.
 */
export function checkVisibleWhen(
  condition: VisibleWhen,
  resource: Resource,
  actionAt: string,
  fields: ReadonlyMap<string, FieldEntry>,
  fieldKeys: readonly string[],
): ValidationError[] {
  const at = `${actionAt}.visibleWhen`;

  const entry = fields.get(condition.field);
  if (!entry) return [unknownField(`${at}.field`, condition.field, resource.key, fieldKeys)];

  const target = entry.field;
  if (target.sensitive) {
    const readable = [...fields.values()]
      .filter((candidate) => !candidate.field.sensitive)
      .map((candidate) => candidate.field.key);
    return [
      sensitiveFieldError({
        path: `${at}.field`,
        key: target.key,
        problem: "cannot decide whether an action is offered",
        fix:
          `Whether a button is drawn is visible to everyone who opens the record, so a condition on a secret answers questions about it one record at a time — ` +
          `point \`${at}.field\` at a non-sensitive field such as one of: ${formatList(readable)}, or remove \`${at}\` and let the endpoint refuse.`,
      }),
    ];
  }

  const stated = [
    condition.equals === undefined ? undefined : "equals",
    condition.isSet === undefined ? undefined : "isSet",
  ].filter((key): key is string => key !== undefined);

  if (stated.length !== 1) return [statesOtherThanOneCondition(at, stated)];

  if (target.type !== "enum" || condition.equals === undefined) return [];
  if (typeof condition.equals === "string" && target.values.includes(condition.equals)) return [];

  return [
    {
      path: `${at}.equals`,
      message: `\`${String(condition.equals)}\` is not one of the values of enum field \`${target.key}\`.`,
      expected: `one of: ${formatList(target.values)}`,
      hint: `Change \`${at}.equals\` to one of: ${formatList(target.values)}.`,
    },
  ];
}

/**
 * Neither condition, or both. Both is the interesting one: two conditions is
 * where an author starts writing a rule, and a rule belongs in the endpoint the
 * action calls rather than in the definition (DECISIONS #010).
 */
function statesOtherThanOneCondition(at: string, stated: readonly string[]): ValidationError {
  const shared = {
    path: at,
    expected: "exactly one of `equals` or `isSet`",
  };

  if (stated.length === 0) {
    return {
      ...shared,
      message: "A `visibleWhen` states no condition.",
      hint: `Add \`equals\` or \`isSet: true\` to \`${at}\`, or remove \`${at}\` to offer this action on every record.`,
    };
  }

  return {
    ...shared,
    message: `A \`visibleWhen\` states ${stated.length} conditions: ${formatList(stated)}.`,
    hint: `Keep one of \`equals\` or \`isSet\` in \`${at}\` and remove the other; a precondition is a single comparison, and anything that needs two belongs in the endpoint the action calls.`,
  };
}
