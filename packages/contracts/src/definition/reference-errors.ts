import { formatList, type ValidationError } from "./errors.js";
import type { Field } from "./fields.js";

/** A field paired with its position, so hints can point at the exact entry. */
export interface FieldEntry {
  field: Field;
  index: number;
}

export function unknownField(
  path: string,
  key: string,
  resourceKey: string,
  fieldKeys: readonly string[],
): ValidationError {
  return {
    path,
    message: `Field \`${key}\` does not exist on resource \`${resourceKey}\`.`,
    expected: `a field key defined on \`${resourceKey}\``,
    hint: `Change \`${path}\` to one of: ${formatList(fieldKeys)}.`,
  };
}

export function duplicateKey(path: string, kind: string, key: string, owner: string): ValidationError {
  return {
    path,
    message: `Duplicate ${kind} key \`${key}\`.`,
    expected: `a unique ${kind} key within ${owner}`,
    hint: `Rename \`${path}\` or remove the duplicate ${kind}; every ${kind} key must appear once in ${owner}.`,
  };
}

/** One place a definition refers to a sensitive field it may not use there. */
interface SensitiveFieldUse {
  path: string;
  key: string;
  /** What the field cannot be, e.g. "cannot be a table column". */
  problem: string;
  /**
   * The safe fix, and only the safe fix. A hint that mentions unsetting
   * `sensitive` is a bypass, not a fix: an authoring agent takes the one-line
   * path, the error disappears, and the leak this check exists to close reopens.
   */
  fix: string;
}

export function sensitiveFieldError({ path, key, problem, fix }: SensitiveFieldUse): ValidationError {
  return {
    path,
    message: `Sensitive field \`${key}\` ${problem}.`,
    expected: "a field that is not marked `sensitive`",
    hint: fix,
  };
}

/** One place a definition refers to a hidden field it may not use there. */
interface HiddenFieldUse {
  path: string;
  key: string;
  /** What the field cannot be, e.g. "cannot be searched". */
  problem: string;
  /** The concrete fix, e.g. "remove `settings` from `...columns`". */
  remedy: string;
  /** Path of the field declaration; `hidden` is a display choice, so unsetting it is a real fix. */
  fieldPath: string;
}

export function hiddenFieldError({ path, key, problem, remedy, fieldPath }: HiddenFieldUse): ValidationError {
  return {
    path,
    message: `Hidden field \`${key}\` ${problem}.`,
    expected: "a field that is not marked `hidden`",
    hint: `\`hidden\` means detail-only: ${remedy}, or unset \`hidden\` on \`${fieldPath}\`.`,
  };
}
