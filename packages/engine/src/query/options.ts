import { OPTIONS_LIMIT, isTextField, type Resource } from "@repanel/contracts";
import { ROW_ALIAS } from "./columns.js";
import { escapeLike } from "./conditions.js";
import { identityField, labelField } from "./fields.js";
import { column, quoteIdentifier } from "./identifier.js";
import { Parameters } from "./parameters.js";
import type { Query } from "./query-builder.js";

/** What a record offered as something to point at answers under. */
export const OPTION_ID_ALIAS = "c0";
export const OPTION_LABEL_ALIAS = "c1";

/**
 * The records a relation may be pointed at, as a picker asks for them: the key
 * that would be written, and the name it is chosen by.
 *
 * It is the narrowest read this engine builds. Two columns — the resource's own
 * primary key and its `labelField` — and no others: not the table view's
 * columns, not the fields a detail read returns, nothing an operator did not
 * ask to see. Both are refused where they are `sensitive`, by the same two
 * guards every other read meets, so the box somebody types into can only ever
 * probe the one column this admin already shows in place of a key.
 *
 * The term is bound, the identifiers are the definition's own and quoted, and
 * the count is ours rather than the caller's: `OPTIONS_LIMIT` rows, whatever
 * was asked (DECISIONS #014, #024).
 */
export function optionsStatement(resource: Resource, term?: string): Query {
  const identity = identityField(resource);
  const label = labelField(resource);
  const parameters = new Parameters();

  const at = column(ROW_ALIAS, label.key);
  // ILIKE compares text. A label that is not text — a key, a number, a day — is
  // read as text for the comparison, because a picker's box is a box somebody
  // types characters into whatever the column underneath holds. A text label is
  // compared as it stands, so an index on it is still an index.
  const matched = isTextField(label) ? at : `${at}::text`;

  const where = term === undefined ? "" : ` where ${matched} ilike ${parameters.bind(`%${escapeLike(term)}%`)}`;
  // The label first, because that is the order the list is read in; then the
  // key, so two records sharing a name do not swap places between one keystroke
  // and the next. A resource named by its key has one term, not the same one
  // twice.
  const order =
    label.key === identity.key
      ? at
      : `${at} asc, ${column(ROW_ALIAS, identity.key)}`;

  return {
    text:
      `select ${select(column(ROW_ALIAS, identity.key), OPTION_ID_ALIAS)}, ${select(at, OPTION_LABEL_ALIAS)}` +
      ` from ${quoteIdentifier(resource.source.table)} as ${quoteIdentifier(ROW_ALIAS)}${where}` +
      ` order by ${order} asc limit ${parameters.bind(OPTIONS_LIMIT)}`,
    values: parameters.values(),
    select: [],
  };
}

function select(expression: string, alias: string): string {
  return `${expression} as ${quoteIdentifier(alias)}`;
}
