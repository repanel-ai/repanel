import { labelFieldOf, type Field, type Resource } from "@repanel/contracts";
import { UnservableResourceError } from "../errors.js";

/** A resource's fields, by key. Referential validation has already run. */
export function indexFields(resource: Resource): ReadonlyMap<string, Field> {
  return new Map(resource.fields.map((field) => [field.key, field]));
}

/**
 * The field a key names. A miss cannot come from a validated definition, so it
 * is ours to explain rather than the author's to fix.
 */
export function requireField(
  fields: ReadonlyMap<string, Field>,
  key: string,
  resource: Resource,
): Field {
  const field = fields.get(key);
  if (!field) throw new Error(`resource \`${resource.key}\` has no field \`${key}\``);
  return field;
}

/**
 * The field a record is addressed by. A sensitive one is refused rather than
 * quietly dropped: the primary key is not only a column, it is the `:id` in
 * every runtime URL and the operand both record lookups compare against, so a
 * resource that has made a secret of it cannot be served at all. Validation
 * rejects this too — this is the same rule standing where the query is built,
 * for a definition stored before the rule existed.
 */
export function identityField(resource: Resource): Field {
  const field = requireField(indexFields(resource), resource.primaryKey, resource);
  if (field.sensitive) {
    throw new UnservableResourceError(
      `Resource \`${resource.key}\` cannot be served: its primary key \`${field.key}\` is marked sensitive.`,
    );
  }
  return field;
}

/**
 * The field a record is named by wherever the admin names one rather than
 * showing it — a relation column, a related list, a picker's list of records to
 * point at. A sensitive one is refused: a label is read in lists that belong to
 * *other* resources, so a resource that has made a secret of its name cannot be
 * pointed at at all. Validation rejects this too — this is the same rule
 * standing where a query is built, for a definition stored before it existed.
 */
export function labelField(resource: Resource): Field {
  const field = requireField(indexFields(resource), labelFieldOf(resource), resource);
  if (field.sensitive) {
    throw new UnservableResourceError(
      `Resource \`${resource.key}\` cannot be pointed at: its label field \`${field.key}\` is marked sensitive.`,
    );
  }
  return field;
}

/**
 * What a list puts on the wire: the columns the table view declares, plus the
 * key each row is addressed by. Hidden fields cannot be columns, so a list
 * payload has none of them without this having to say so.
 */
export function listFields(resource: Resource): Field[] {
  const fields = indexFields(resource);
  const identity = identityField(resource);
  const columns = resource.views.table.columns.map((key) => requireField(fields, key, resource));

  return columns.some((field) => field.key === identity.key) ? columns : [...columns, identity];
}
