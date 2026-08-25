import { identifierSchema } from "@repanel/contracts";

/**
 * The one place an identifier is written into SQL. Two guarantees stack here:
 * the pattern a definition identifier must match has no room for a quote, and
 * the quoting happens whether or not anything looks dangerous — so a table
 * called `User` reaches Postgres as `User` rather than folded to `user`, and
 * nothing that is not a definition identifier reaches it at all.
 *
 * A refusal is a bug in us, never a caller's mistake: every value that gets
 * here came out of a definition that has already been validated, or is one of
 * our own aliases. So it throws rather than raising a domain error, and the
 * exception filter answers the request with nothing but a 500.
 */
export function quoteIdentifier(value: string): string {
  if (!identifierSchema.safeParse(value).success) {
    throw new Error(`\`${value}\` is not a definition identifier and cannot be written into SQL`);
  }
  return `"${value}"`;
}

/** One column of one table, both halves quoted: `"t"."avatarUrl"`. */
export function column(tableAlias: string, key: string): string {
  return `${quoteIdentifier(tableAlias)}.${quoteIdentifier(key)}`;
}
