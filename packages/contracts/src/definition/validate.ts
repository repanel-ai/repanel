import type { ValidationError } from "./errors.js";
import { checkReferences } from "./references.js";
import { definitionSchema, type Definition } from "./schema.js";
import { translateZodIssues } from "./zod-errors.js";

export type ValidationResult =
  | { valid: true; definition: Definition }
  | { valid: false; errors: ValidationError[] };

/**
 * Validates a RePanel definition in two passes: the zod parse, then the
 * cross-reference checks zod cannot express. A structural failure skips the
 * referential pass — those checks need a well-typed definition to walk, and
 * errors invented from a half-parsed tree would point at the wrong place.
 */
export function validateDefinition(input: unknown): ValidationResult {
  const parsed = definitionSchema.safeParse(input);
  if (!parsed.success) {
    return { valid: false, errors: translateZodIssues(parsed.error.issues, input) };
  }

  const errors = checkReferences(parsed.data);
  if (errors.length > 0) return { valid: false, errors };

  return { valid: true, definition: parsed.data };
}
