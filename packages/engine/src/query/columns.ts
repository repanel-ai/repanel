import type { Field, Resource } from "@repanel/contracts";
import { labelField } from "./fields.js";
import { column, quoteIdentifier } from "./identifier.js";

/** The table every record query reads its own columns from. */
export const ROW_ALIAS = "t";

/** What one selected column holds, so a row can be read back without guessing. */
export interface SelectEntry {
  /** Our own output name for it: `c0`, `c1`, … */
  alias: string;
  /** The field key it belongs to in the record. */
  key: string;
  /** `value` is the field itself; `label` is what its target is called. */
  kind: "value" | "label";
  /** The field the value is read as — for a label, the target's label field. */
  field: Field;
}

export interface Selection {
  /** The select list: `"t"."email" as "c0", …` */
  columns: string;
  /** The joins the labels need, or an empty string when there are none. */
  joins: string;
  /** One entry per selected column, in the order they are listed. */
  entries: SelectEntry[];
}

/**
 * The select list for a set of fields, and the joins that give a relation
 * column something readable in place of a key.
 *
 * This is the only place a select list is built, which is what makes "a
 * sensitive field is never selected" a property of the code rather than a rule
 * to remember: a sensitive field is dropped here, and there is no other door.
 *
 * Every output column is named by us — `c0`, `c1`, … — rather than by the
 * customer's column names. Postgres allows two output columns to share a name
 * and the driver keeps the last, so a joined label could otherwise stand in
 * for a column of the row it was joined to.
 */
export function selectFields(
  fields: readonly Field[],
  resources: ReadonlyMap<string, Resource>,
): Selection {
  const entries: SelectEntry[] = [];
  const columns: string[] = [];
  const joins: string[] = [];

  for (const field of fields) {
    if (field.sensitive) continue;

    columns.push(select(column(ROW_ALIAS, field.key), entries.length));
    entries.push({ alias: aliasFor(entries.length), key: field.key, kind: "value", field });

    // A relation field names its target itself, and nothing requires a matching
    // relationship to be declared alongside it — so the join is keyed off the
    // field. Relationships describe how to travel between records; this is
    // about what to read in one.
    if (field.type !== "relation") continue;

    const target = resources.get(field.target);
    if (!target) {
      throw new Error(`relation field \`${field.key}\` targets unknown resource \`${field.target}\``);
    }

    // The label is joined into a list that belongs to another resource, so it
    // is subject to the same rule as any other column in that list — and to the
    // same refusal, which lives with the field it is about (`fields.ts`) so
    // that every path to a label inherits it rather than repeating it.
    const label = labelField(target);

    const joinAlias = `j${joins.length}`;
    joins.push(
      `left join ${quoteIdentifier(target.source.table)} as ${quoteIdentifier(joinAlias)}` +
        ` on ${column(joinAlias, target.primaryKey)} = ${column(ROW_ALIAS, field.key)}`,
    );
    columns.push(select(column(joinAlias, label.key), entries.length));
    entries.push({ alias: aliasFor(entries.length), key: field.key, kind: "label", field: label });
  }

  return { columns: columns.join(", "), joins: joins.join(" "), entries };
}

function aliasFor(position: number): string {
  return `c${position}`;
}

function select(expression: string, position: number): string {
  return `${expression} as ${quoteIdentifier(aliasFor(position))}`;
}
