import { formatList, type ValidationError } from "./errors.js";
import type { Resource } from "./schema.js";

/**
 * Every value a `tones` map speaks about must be one the enum declares. A key
 * that is not in `values` names a state the admin can never render — the map is
 * read by value, so the entry is silently unreachable, and a silent
 * degradation is the one outcome DECISIONS #008 has no answer for.
 */
export function checkTones(resource: Resource, at: string): ValidationError[] {
  const errors: ValidationError[] = [];

  resource.fields.forEach((field, index) => {
    if (field.type !== "enum") return;

    for (const value of Object.keys(field.tones)) {
      if (field.values.includes(value)) continue;
      errors.push(unknownEnumValue(`${at}.fields[${index}].tones`, value, field.key, field.values));
    }
  });

  return errors;
}

/**
 * The safe fixes, and only those: correct the key, or drop the entry. Adding
 * the value to `values` would make the error disappear too, and it is the
 * shortest path — which is exactly why the hint must not name it (#015).
 * `values` is the customer's real vocabulary: it fills the enum filter and
 * bounds what a `dbUpdate` may write, so a value invented to satisfy a colour
 * offers operators a state no row holds and an action the column refuses.
 */
function unknownEnumValue(
  at: string,
  value: string,
  fieldKey: string,
  values: readonly string[],
): ValidationError {
  return {
    path: `${at}.${value}`,
    message: `Field \`${fieldKey}\` has no value \`${value}\` to give a tone to.`,
    expected: `one of the values declared by \`${fieldKey}\``,
    hint: `Change \`${at}.${value}\` to one of: ${formatList(values)}, or remove the entry; a value with no tone is legal and renders quiet.`,
  };
}
