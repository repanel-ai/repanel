import type { Action } from "./actions.js";
import { formatList, type ValidationError } from "./errors.js";
import type { Field } from "./fields.js";
import { unknownField, type FieldEntry } from "./reference-errors.js";
import type { Resource } from "./schema.js";

/**
 * Every field an action names must exist, be safe to write from the admin, and
 * — for an `httpCall` — be safe to put in a URL.
 */
export function checkActions(
  resource: Resource,
  at: string,
  fields: ReadonlyMap<string, FieldEntry>,
  fieldKeys: readonly string[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  resource.actions.forEach((action, index) => {
    const actionAt = `${at}.actions[${index}]`;

    if (action.kind === "dbUpdate") {
      const entry = fields.get(action.field);
      if (!entry) {
        errors.push(unknownField(`${actionAt}.field`, action.field, resource.key, fieldKeys));
        return;
      }
      errors.push(...checkDbUpdate(action, entry.field, actionAt));
      return;
    }

    for (const placeholder of new Set(placeholdersIn(action.url))) {
      const entry = fields.get(placeholder);
      if (!entry) {
        errors.push({
          path: `${actionAt}.url`,
          message: `URL template references unknown field \`{${placeholder}}\`.`,
          expected: `placeholders naming fields of \`${resource.key}\``,
          hint: `Replace \`{${placeholder}}\` in \`${actionAt}.url\` with one of: ${formatList(fieldKeys)}.`,
        });
        continue;
      }
      if (entry.field.sensitive) {
        errors.push({
          path: `${actionAt}.url`,
          message: `URL template interpolates sensitive field \`{${placeholder}}\`.`,
          expected: "placeholders naming fields that are not marked `sensitive`",
          hint: `A URL reaches access logs, proxies and error trackers — replace \`{${placeholder}}\` in \`${actionAt}.url\` with a non-sensitive identifier such as the primary key \`{${resource.primaryKey}}\`.`,
        });
      }
    }
  });

  return errors;
}

/**
 * A `dbUpdate` sets an `enum` or `boolean` field and nothing else. Every other
 * type carries rules the runtime cannot know about — validation, side effects,
 * cascades — so those updates belong in a customer endpoint reached by an
 * `httpCall` action (DECISIONS #010).
 */
function checkDbUpdate(
  action: Extract<Action, { kind: "dbUpdate" }>,
  target: Field,
  actionAt: string,
): ValidationError[] {
  if (target.sensitive) {
    return [
      {
        path: `${actionAt}.field`,
        message: `A \`dbUpdate\` action cannot target sensitive field \`${target.key}\`.`,
        expected: "a field of type `enum` or `boolean` that is not marked `sensitive`",
        hint: `Secrets are never written from the admin — move this update into an endpoint in your application and call it with an \`httpCall\` action (see DECISIONS #010).`,
      },
    ];
  }

  if (target.type === "enum") {
    if (typeof action.value === "string" && target.values.includes(action.value)) return [];
    return [
      {
        path: `${actionAt}.value`,
        message: `\`${String(action.value)}\` is not one of the values of enum field \`${target.key}\`.`,
        expected: `one of: ${formatList(target.values)}`,
        hint: `Change \`${actionAt}.value\` to one of: ${formatList(target.values)}.`,
      },
    ];
  }

  if (target.type === "boolean") {
    if (typeof action.value === "boolean") return [];
    return [
      {
        path: `${actionAt}.value`,
        message: `\`${String(action.value)}\` is not a boolean.`,
        expected: "`true` or `false`",
        hint: `Change \`${actionAt}.value\` to \`true\` or \`false\`; a boolean field accepts only those two literals.`,
      },
    ];
  }

  return [
    {
      path: `${actionAt}.field`,
      message: `A \`dbUpdate\` action cannot target field \`${target.key}\` of type \`${target.type}\`.`,
      expected: "a field of type `enum` or `boolean`",
      hint: `v0 sets only \`enum\` and \`boolean\` fields directly — a rule-bearing update belongs in an endpoint in your application, called with an \`httpCall\` action (see DECISIONS #010).`,
    },
  ];
}

function placeholdersIn(url: string): string[] {
  return [...url.matchAll(/\{([^}]*)\}/g)].map((match) => match[1] ?? "");
}
