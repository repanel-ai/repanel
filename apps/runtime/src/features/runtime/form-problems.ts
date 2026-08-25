import type { ValidationError } from "@repanel/contracts";

/** Where every refusal about a submitted value is reported. */
const VALUES = "values";

export interface FormProblems {
  /** What is wrong with one value, keyed by the field it belongs to. */
  fields: Record<string, string>;
  /** What is wrong with the write as a whole, if anything is. */
  form?: string;
}

/**
 * Where each refusal is shown.
 *
 * The write path answers in one shape and every problem with a value carries
 * `values.<field key>` (DECISIONS #056), which is the whole reason a form can
 * put a sentence under the input it belongs to. Anything else — a refusal about
 * the write as a whole, or one naming a field this screen did not draw — is
 * shown at the form, because a refusal shown nowhere is a form that looks like
 * it did nothing. `drawn` is what makes that second case answerable: the write
 * path knows every field a resource has, this screen knows only the ones it put
 * on the page, and only one of them can say where a sentence will be seen.
 *
 * The sentence is the one that was written upstream, and nothing here rewrites
 * it: the API's words are the only account of the refusal that will reach this
 * browser, exactly as they are for an action that failed (DESIGN.md §10).
 */
export function problemsIn(
  errors: readonly ValidationError[],
  drawn: ReadonlySet<string>,
): FormProblems {
  const fields: Record<string, string> = {};
  let form: string | undefined;

  for (const error of errors) {
    const key = error.path.startsWith(`${VALUES}.`) ? error.path.slice(VALUES.length + 1) : undefined;
    if (key !== undefined && drawn.has(key)) fields[key] = error.message;
    else form ??= error.message;
  }

  return form === undefined ? { fields } : { fields, form };
}
