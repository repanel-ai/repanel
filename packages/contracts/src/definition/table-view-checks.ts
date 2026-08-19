import { formatList, type ValidationError } from "./errors.js";
import { isTextField, TEXT_FIELD_TYPES, type FieldType } from "./fields.js";
import { hiddenFieldError, sensitiveFieldError, unknownField, type FieldEntry } from "./reference-errors.js";
import type { Resource } from "./schema.js";
import type { FilterKind } from "./views.js";

/** The filter kind each field type supports; absent types cannot be filtered in v0. */
const FILTER_KIND_BY_FIELD_TYPE: Partial<Record<FieldType, FilterKind>> = {
  enum: "enum",
  boolean: "boolean",
  date: "dateRange",
  dateTime: "dateRange",
  relation: "relation",
};

const FILTERABLE_FIELD_TYPES = Object.keys(FILTER_KIND_BY_FIELD_TYPE);

/**
 * Every field a table view names must exist and be usable in a list: sensitive
 * values are neither shown nor probeable, and hidden ones are absent from the
 * list payload entirely.
 */
export function checkTableView(
  resource: Resource,
  at: string,
  fields: ReadonlyMap<string, FieldEntry>,
  fieldKeys: readonly string[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const table = resource.views.table;
  const tableAt = `${at}.views.table`;

  table.columns.forEach((key, index) => {
    const path = `${tableAt}.columns[${index}]`;
    const entry = fields.get(key);
    if (!entry) {
      errors.push(unknownField(path, key, resource.key, fieldKeys));
      return;
    }
    if (entry.field.sensitive) {
      errors.push(
        sensitiveFieldError({
          path,
          key,
          problem: "cannot be a table column",
          fix: `Remove \`${key}\` from \`${tableAt}.columns\` and show a non-sensitive field instead; a sensitive value never leaves the API unmasked.`,
        }),
      );
      return;
    }
    if (entry.field.hidden) {
      errors.push(
        hiddenFieldError({
          path,
          key,
          problem: "cannot be a table column",
          remedy: `remove \`${key}\` from \`${tableAt}.columns\``,
          fieldPath: `${at}.fields[${entry.index}]`,
        }),
      );
    }
  });

  const sortAt = `${tableAt}.defaultSort.field`;
  const sortEntry = fields.get(table.defaultSort.field);
  if (!sortEntry) {
    errors.push(unknownField(sortAt, table.defaultSort.field, resource.key, fieldKeys));
  } else if (sortEntry.field.sensitive) {
    // An ordering is a comparison the caller can page through: the values never
    // render, but the ranking they impose on the rows beside them does, one page
    // boundary at a time. DECISIONS #014 counts that as probing.
    errors.push(
      sensitiveFieldError({
        path: sortAt,
        key: table.defaultSort.field,
        problem: "cannot be the default sort",
        fix: `Ordering by a field exposes the order it puts the rows in, which is readable from the pages even though the values are not — change \`${sortAt}\` to a non-sensitive field such as one of: ${formatList(sortableKeys(fields))}.`,
      }),
    );
  } else if (sortEntry.field.hidden) {
    errors.push(
      hiddenFieldError({
        path: sortAt,
        key: table.defaultSort.field,
        problem: "cannot be the default sort",
        remedy: "sort by a field the table displays",
        fieldPath: `${at}.fields[${sortEntry.index}]`,
      }),
    );
  }

  table.search.forEach((key, index) => {
    const path = `${tableAt}.search[${index}]`;
    const entry = fields.get(key);
    if (!entry) {
      errors.push(unknownField(path, key, resource.key, fieldKeys));
      return;
    }
    if (entry.field.sensitive) {
      errors.push(
        sensitiveFieldError({
          path,
          key,
          problem: "cannot be searched",
          fix: `Remove \`${key}\` from \`${tableAt}.search\` and search a non-sensitive field instead; a sensitive value must never be probeable.`,
        }),
      );
      return;
    }
    if (entry.field.hidden) {
      errors.push(
        hiddenFieldError({
          path,
          key,
          problem: "cannot be searched",
          remedy: `remove \`${key}\` from \`${tableAt}.search\``,
          fieldPath: `${at}.fields[${entry.index}]`,
        }),
      );
      return;
    }
    if (!isTextField(entry.field)) {
      errors.push({
        path,
        message: `Field \`${key}\` has type \`${entry.field.type}\` and cannot be searched.`,
        expected: `a field of type ${formatList(TEXT_FIELD_TYPES)}`,
        hint: `Remove \`${key}\` from \`${tableAt}.search\`; free-text search only covers ${formatList(TEXT_FIELD_TYPES)} fields.`,
      });
    }
  });

  table.filters.forEach((filter, index) => {
    const filterAt = `${tableAt}.filters[${index}]`;
    const entry = fields.get(filter.field);
    if (!entry) {
      errors.push(unknownField(`${filterAt}.field`, filter.field, resource.key, fieldKeys));
      return;
    }
    if (entry.field.sensitive) {
      errors.push(
        sensitiveFieldError({
          path: `${filterAt}.field`,
          key: filter.field,
          problem: "cannot be filtered",
          fix: `Remove the filter at \`${filterAt}\` and filter a non-sensitive field instead; a sensitive value must never be probeable.`,
        }),
      );
      return;
    }
    if (entry.field.hidden) {
      errors.push(
        hiddenFieldError({
          path: `${filterAt}.field`,
          key: filter.field,
          problem: "cannot be filtered",
          remedy: `remove the filter at \`${filterAt}\``,
          fieldPath: `${at}.fields[${entry.index}]`,
        }),
      );
      return;
    }
    const supported = FILTER_KIND_BY_FIELD_TYPE[entry.field.type];
    if (!supported) {
      errors.push({
        path: filterAt,
        message: `Field \`${filter.field}\` has type \`${entry.field.type}\` and cannot be filtered.`,
        expected: `a filter bound to a field of type ${formatList(FILTERABLE_FIELD_TYPES)}`,
        hint: `Remove the filter at \`${filterAt}\`; v0 filters only ${formatList(FILTERABLE_FIELD_TYPES)} fields.`,
      });
      return;
    }
    if (supported !== filter.kind) {
      errors.push({
        path: `${filterAt}.kind`,
        message: `Filter kind \`${filter.kind}\` does not match field \`${filter.field}\` of type \`${entry.field.type}\`.`,
        expected: `kind \`${supported}\` for field type \`${entry.field.type}\``,
        hint: `Change \`${filterAt}.kind\` to \`${supported}\`, or bind the filter to a field that uses \`${filter.kind}\`.`,
      });
    }
  });

  return errors;
}

/** What a table may be ordered by: shown in the list, and safe to rank rows by. */
function sortableKeys(fields: ReadonlyMap<string, FieldEntry>): string[] {
  return [...fields.values()]
    .filter((entry) => !entry.field.sensitive && !entry.field.hidden)
    .map((entry) => entry.field.key);
}
