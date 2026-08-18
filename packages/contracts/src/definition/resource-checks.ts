import { checkActions } from "./action-checks.js";
import { checkDetailView } from "./detail-view-checks.js";
import { formatList, type ValidationError } from "./errors.js";
import { duplicateKey, unknownField, type FieldEntry } from "./reference-errors.js";
import type { Relationship, Resource } from "./schema.js";
import { checkTableView } from "./table-view-checks.js";

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

  if (!fields.has(resource.primaryKey)) {
    errors.push(unknownField(`${at}.primaryKey`, resource.primaryKey, resource.key, fieldKeys));
  }

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
  const ownerFieldKeys =
    relationship.kind === "belongsTo" ? [...fields.keys()] : target.fields.map((field) => field.key);
  if (ownerFieldKeys.includes(relationship.foreignKey)) return [];

  const path = `${at}.foreignKey`;
  return [
    {
      path,
      message: `Foreign key \`${relationship.foreignKey}\` does not exist on resource \`${owner.key}\`.`,
      expected: `a field key defined on \`${owner.key}\``,
      hint: `A \`${relationship.kind}\` relationship reads its foreign key from \`${owner.key}\`; change \`${path}\` to one of: ${formatList(ownerFieldKeys)}.`,
    },
  ];
}
