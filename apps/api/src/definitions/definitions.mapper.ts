import type { ValidationError } from "@repanel/contracts";
import type { DefinitionRow } from "./definitions.repository";

/** What validation concluded about a stored draft. */
export interface StoredValidation {
  valid: boolean;
  /** The full error list when invalid, never truncated; null when valid. */
  errors: ValidationError[] | null;
}

/** A project's stored draft: what was submitted, and how it fared. */
export interface DefinitionDraft extends StoredValidation {
  /** Exactly what was submitted, valid or not. */
  payload: unknown;
  /** ISO 8601: the draft outlives this process, so it carries no `Date`. */
  updatedAt: string;
}

/** The only way a definition row leaves the feature. Row ids stay behind. */
export function toDefinitionDraft(definition: DefinitionRow): DefinitionDraft {
  return {
    payload: definition.payload,
    ...toStoredValidation(definition),
    updatedAt: definition.updatedAt.toISOString(),
  };
}

/** The verdict on its own, for a caller that does not need the payload. */
export function toStoredValidation(definition: DefinitionRow): StoredValidation {
  return {
    valid: definition.valid,
    errors: definition.errors ?? null,
  };
}
