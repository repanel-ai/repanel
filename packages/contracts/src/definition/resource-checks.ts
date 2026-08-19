import { checkActions } from "./action-checks.js";
import { checkDetailView } from "./detail-view-checks.js";
import { formatList, type ValidationError } from "./errors.js";
import type { FieldType } from "./fields.js";
import {
  duplicateKey,
  hiddenFieldError,
  sensitiveFieldError,
  unknownField,
  type FieldEntry,
} from "./reference-errors.js";
import type { Relationship, Resource } from "./schema.js";
import { checkTableView } from "./table-view-checks.js";

/** Types with no single reading to show, so nothing to name a record with. */
const UNLABELLABLE_FIELD_TYPES: ReadonlySet<FieldType> = new Set(["json", "relation"]);

/**
 * One resource's own references: its keys are unique, and its primary key,
 * relation fields and relationships all name things that exist. Indexes the
 * resource's fields once, then hands that index to the view and action checks.
 */
export function checkResource(
  resource: Resource,
  at: string,
  resources: ReadonlyMap<string, Resource>,
  resourceKeys: readonly string[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  const fields = new Map<string, FieldEntry>();
  const relationships = new Map<string, Relationship>();
  const actionKeys = new Set<string>();

  resource.fields.forEach((field, index) => {
    if (fields.has(field.key)) {
      errors.push(duplicateKey(`${at}.fields[${index}].key`, "field", field.key, `resource \`${resource.key}\``));
      return;
    }
    fields.set(field.key, { field, index });
  });

  resource.relationships.forEach((relationship, index) => {
    if (relationships.has(relationship.key)) {
      errors.push(
        duplicateKey(`${at}.relationships[${index}].key`, "relationship", relationship.key, `resource \`${resource.key}\``),
      );
      return;
    }
    relationships.set(relationship.key, relationship);
  });

  resource.actions.forEach((action, index) => {
    if (actionKeys.has(action.key)) {
      errors.push(duplicateKey(`${at}.actions[${index}].key`, "action", action.key, `resource \`${resource.key}\``));
      return;
    }
    actionKeys.add(action.key);
  });

  const fieldKeys = [...fields.keys()];

  errors.push(...checkPrimaryKey(resource, at, fields, fieldKeys));
  errors.push(...checkLabelField(resource, at, fields, fieldKeys));

  resource.fields.forEach((field, index) => {
    if (field.type !== "relation" || resources.has(field.target)) return;
    const path = `${at}.fields[${index}].target`;
    errors.push({
      path,
      message: `Relation field \`${field.key}\` targets unknown resource \`${field.target}\`.`,
      expected: "a key of a resource defined in `resources`",
      hint: `Change \`${path}\` to one of: ${formatList(resourceKeys)}.`,
    });
  });

  resource.relationships.forEach((relationship, index) => {
    errors.push(...checkRelationship(relationship, `${at}.relationships[${index}]`, resource, fields, resources, resourceKeys));
  });

  errors.push(...checkTableView(resource, at, fields, fieldKeys));
  errors.push(...checkDetailView(resource, at, fields, fieldKeys, [...relationships.keys()]));
  errors.push(...checkActions(resource, at, fields, fieldKeys));

  return errors;
}

/**
 * A record is addressed by its primary key, so the value travels in every URL,
 * link and access log that reaches it. That is a surface, and DECISIONS #014
 * admits no sensitive value onto one.
 */
function checkPrimaryKey(
  resource: Resource,
  at: string,
  fields: ReadonlyMap<string, FieldEntry>,
  fieldKeys: readonly string[],
): ValidationError[] {
  const path = `${at}.primaryKey`;
  const entry = fields.get(resource.primaryKey);
  if (!entry) return [unknownField(path, resource.primaryKey, resource.key, fieldKeys)];
  if (!entry.field.sensitive) return [];

  const addressable = keysWhere(fields, (field) => !field.sensitive);
  return [
    sensitiveFieldError({
      path,
      key: resource.primaryKey,
      problem: "cannot be the primary key",
      fix: `A record's primary key is how the admin addresses it, so it is in every URL and every log line that reaches the record — point \`${path}\` at a non-sensitive identifier such as one of: ${formatList(addressable)}.`,
    }),
  ];
}

/**
 * The label is what a human reads instead of a record: it names the row in a
 * relation column, a related list and every link. So it has to exist, has to
 * render, and — being shown in lists that belong to other resources — must
 * carry nothing a list may not carry.
 */
function checkLabelField(
  resource: Resource,
  at: string,
  fields: ReadonlyMap<string, FieldEntry>,
  fieldKeys: readonly string[],
): ValidationError[] {
  const { labelField } = resource;
  if (labelField === undefined) return [];

  const path = `${at}.labelField`;
  const entry = fields.get(labelField);
  if (!entry) return [unknownField(path, labelField, resource.key, fieldKeys)];

  const candidates = keysWhere(
    fields,
    (field) => !field.sensitive && !field.hidden && !UNLABELLABLE_FIELD_TYPES.has(field.type),
  );

  if (entry.field.sensitive) {
    return [
      sensitiveFieldError({
        path,
        key: labelField,
        problem: "cannot be the label field",
        fix: `A label names the record wherever it is pointed at, including in lists that belong to other resources — change \`${path}\` to a non-sensitive field such as one of: ${formatList(candidates)}.`,
      }),
    ];
  }

  if (entry.field.hidden) {
    return [
      hiddenFieldError({
        path,
        key: labelField,
        problem: "cannot be the label field",
        remedy: `name \`${resource.key}\` with a field the admin shows`,
        fieldPath: `${at}.fields[${entry.index}]`,
      }),
    ];
  }

  if (!UNLABELLABLE_FIELD_TYPES.has(entry.field.type)) return [];

  return [
    {
      path,
      message: `Field \`${labelField}\` has type \`${entry.field.type}\` and cannot be a label.`,
      expected: "a field whose value reads as a name",
      hint: `Change \`${path}\` to a field that names the record, such as one of: ${formatList(candidates)}; a \`${entry.field.type}\` value has no single reading to show in its place.`,
    },
  ];
}

function keysWhere(
  fields: ReadonlyMap<string, FieldEntry>,
  matches: (field: FieldEntry["field"]) => boolean,
): string[] {
  return [...fields.values()].filter((entry) => matches(entry.field)).map((entry) => entry.field.key);
}

function checkRelationship(
  relationship: Relationship,
  at: string,
  resource: Resource,
  fields: ReadonlyMap<string, FieldEntry>,
  resources: ReadonlyMap<string, Resource>,
  resourceKeys: readonly string[],
): ValidationError[] {
  const target = resources.get(relationship.target);
  if (!target) {
    return [
      {
        path: `${at}.target`,
        message: `Relationship \`${relationship.key}\` targets unknown resource \`${relationship.target}\`.`,
        expected: "a key of a resource defined in `resources`",
        hint: `Change \`${at}.target\` to one of: ${formatList(resourceKeys)}.`,
      },
    ];
  }

  // `belongsTo` stores the foreign key on this resource; `hasMany` reads it
  // from the target.
  const owner = relationship.kind === "belongsTo" ? resource : target;
  const ownerFields =
    relationship.kind === "belongsTo" ? [...fields.values()].map((entry) => entry.field) : target.fields;
  const path = `${at}.foreignKey`;
  const foreignKey = ownerFields.find((field) => field.key === relationship.foreignKey);

  if (!foreignKey) {
    return [
      {
        path,
        message: `Foreign key \`${relationship.foreignKey}\` does not exist on resource \`${owner.key}\`.`,
        expected: `a field key defined on \`${owner.key}\``,
        hint: `A \`${relationship.kind}\` relationship reads its foreign key from \`${owner.key}\`; change \`${path}\` to one of: ${formatList(ownerFields.map((field) => field.key))}.`,
      },
    ];
  }

  if (!foreignKey.sensitive) return [];

  // Traversal reads the column and compares against it: a `belongsTo` selects
  // the key out of the record to find the other end, a `hasMany` narrows the
  // target's list by it. Both are surfaces DECISIONS #014 admits no sensitive
  // value onto — the second answers "which records carry this value" from a
  // count, without ever rendering one.
  const joinable = ownerFields.filter((field) => !field.sensitive).map((field) => field.key);
  return [
    sensitiveFieldError({
      path,
      key: relationship.foreignKey,
      problem: "cannot be a foreign key",
      fix: `A \`${relationship.kind}\` relationship is traversed by reading \`${owner.key}\`'s \`${relationship.foreignKey}\` and matching on it, so the value is both selected and probeable — point \`${path}\` at a non-sensitive join column such as one of: ${formatList(joinable)}, or drop the relationship at \`${at}\`.`,
    }),
  ];
}
