import type { VisibleWhen } from "./actions.js";
import { formatList, type ValidationError } from "./errors.js";
import type { Field, FieldType } from "./fields.js";
import { sensitiveFieldError, unknownField, type FieldEntry } from "./reference-errors.js";
import type { Resource } from "./schema.js";

/**
 * What an `equals` literal must be, for each field type one may be stated
 * against — and, by the types it leaves out, which fields may not be compared
 * at all. A `relation` holds a key the admin renders as a label, `json` holds a
 * structure no single literal addresses, a `date` or `dateTime` holds a moment
 * whose text form is a rendering choice, and a `longText` holds prose. An
 * `equals` against any of them is a comparison that quietly never holds, which
 * is a button that is silently never drawn — the class this check closes.
 *
 * `enum` is comparable and is checked against its own declared values below;
 * it is listed here so that one map is both the rule and the list an error
 * offers, and the two cannot drift.
 */
const EQUALS_LITERAL: Partial<Record<FieldType, LiteralKind>> = {
  text: "string",
  enum: "string",
  boolean: "boolean",
  number: "number",
  email: "string",
  url: "string",
};

type LiteralKind = "string" | "number" | "boolean";

/** How each kind of literal is named in an error, and what a correct one is. */
const LITERAL = {
  string: { name: "a string", expected: "a string" },
  number: { name: "a number", expected: "a number" },
  boolean: { name: "a boolean", expected: "`true` or `false`" },
} as const satisfies Record<LiteralKind, { name: string; expected: string }>;

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

  // `isSet` asks whether the record holds anything here, which every type can
  // answer. Only `equals` has to know what kind of value it is comparing.
  if (condition.equals === undefined) return [];

  const kind = EQUALS_LITERAL[target.type];
  if (!kind) return [cannotBeCompared(at, target)];

  // An enum says in the definition which strings it takes, so it answers with
  // its own values rather than with the kind of literal it wanted.
  if (target.type === "enum") {
    if (typeof condition.equals === "string" && target.values.includes(condition.equals)) return [];
    return [notOneOfTheValues(at, target.key, target.values, condition.equals)];
  }

  if (typeof condition.equals !== kind) {
    return [wrongKindOfLiteral(at, target, kind, condition.equals)];
  }

  return [];
}

/**
 * A field whose values no literal can name. The fix is the rung below — ask
 * only that it is set — or the file above: a rule lives in the endpoint the
 * action calls (DECISIONS #010).
 */
function cannotBeCompared(at: string, target: Field): ValidationError {
  return {
    path: `${at}.field`,
    message: `A \`visibleWhen\` cannot compare field \`${target.key}\` of type \`${target.type}\` with \`equals\`.`,
    expected: `a field of type ${formatList(Object.keys(EQUALS_LITERAL))}`,
    hint:
      `Ask only that it holds something — \`{ "field": "${target.key}", "isSet": true }\` — or state the rule in the endpoint the action calls, ` +
      `where it can be tested (see DECISIONS #010).`,
  };
}

/** The right field, the wrong sort of value for it. Nothing is coerced. */
function wrongKindOfLiteral(
  at: string,
  target: Field,
  kind: LiteralKind,
  value: string | number | boolean,
): ValidationError {
  const { name, expected } = LITERAL[kind];
  return {
    path: `${at}.equals`,
    message: `\`${String(value)}\` is not ${name}.`,
    expected,
    hint: `Change \`${at}.equals\` to ${expected}; \`${target.key}\` is a \`${target.type}\` field, and nothing is coerced across types.`,
  };
}

function notOneOfTheValues(
  at: string,
  key: string,
  values: readonly string[],
  value: string | number | boolean,
): ValidationError {
  return {
    path: `${at}.equals`,
    message: `\`${String(value)}\` is not one of the values of enum field \`${key}\`.`,
    expected: `one of: ${formatList(values)}`,
    hint: `Change \`${at}.equals\` to one of: ${formatList(values)}.`,
  };
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
