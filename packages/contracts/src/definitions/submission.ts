import type { ValidationError } from "../definition/errors.js";

/**
 * What a submission answers. A definition that did not validate is stored all
 * the same, so this is a verdict rather than a failure: the errors are a work
 * list, and the URL is where the admin the definition describes can be opened.
 *
 * The address is answered rather than composed by the caller. Where the
 * rendered admin lives is a fact about the deployment, and the deployment is
 * what is being submitted to.
 */
export type DefinitionSubmissionDto =
  | { valid: true; adminUrl: string }
  | { valid: false; errors: ValidationError[] };
