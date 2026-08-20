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

  // Tabs with nothing to put in them is one tab, which is a page. The author
  // meant something by asking for tabs, and this is the one chance to say that
  // what they asked for cannot happen.
  if (resource.views.detail.relatedLayout === "tabs" && resource.views.detail.relatedLists.length === 0) {
    errors.push({
      path: `${detailAt}.relatedLayout`,
      message: `Resource \`${resource.key}\` asks for tabs but names no related lists.`,
      expected: "at least one related list, or the `inline` layout",
      hint:
        relationshipKeys.length > 0
          ? `Add a relationship key to \`${detailAt}.relatedLists\` — one of: ${formatList(relationshipKeys)} — or set \`${detailAt}.relatedLayout\` to \`inline\`.`
          : `Resource \`${resource.key}\` defines no relationships to put in a tab; set \`${detailAt}.relatedLayout\` to \`inline\`.`,
    });
  }

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
