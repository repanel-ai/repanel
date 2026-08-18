import { formatList, type ValidationError } from "./errors.js";
import { unknownField, type FieldEntry } from "./reference-errors.js";
import type { Resource } from "./schema.js";

/**
 * Every field a detail view names must exist, and every related list must name
 * a relationship of the resource. Hidden fields are welcome here — hidden means
 * detail-only.
 */
export function checkDetailView(
  resource: Resource,
  at: string,
  fields: ReadonlyMap<string, FieldEntry>,
  fieldKeys: readonly string[],
  relationshipKeys: readonly string[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const detailAt = `${at}.views.detail`;

  resource.views.detail.sections.forEach((section, sectionIndex) => {
    section.fields.forEach((key, index) => {
      if (fields.has(key)) return;
      errors.push(
        unknownField(`${detailAt}.sections[${sectionIndex}].fields[${index}]`, key, resource.key, fieldKeys),
      );
    });
  });

  resource.views.detail.relatedLists.forEach((key, index) => {
    if (relationshipKeys.includes(key)) return;
    const path = `${detailAt}.relatedLists[${index}]`;
    errors.push({
      path,
      message: `Related list references unknown relationship \`${key}\`.`,
      expected: `a relationship key defined on \`${resource.key}\``,
      hint:
        relationshipKeys.length > 0
          ? `Change \`${path}\` to one of: ${formatList(relationshipKeys)}.`
          : `Resource \`${resource.key}\` defines no relationships — add one to \`${at}.relationships\` first.`,
    });
  });

  return errors;
}
