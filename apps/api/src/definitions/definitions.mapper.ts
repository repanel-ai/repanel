import type { DefinitionStatusDto, ValidationError } from "@repanel/contracts";
import type { DefinitionRow } from "./definitions.repository";

/** What validation concluded about a stored draft, and when it concluded it. */
export interface StoredValidation {
  valid: boolean;
  /** The full error list when invalid, never truncated; null when valid. */
  errors: ValidationError[] | null;
  /** ISO 8601: the draft outlives this process, so it carries no `Date`. */
  updatedAt: string;
}

/** A project's stored draft: what was submitted, and how it fared. */
export interface DefinitionDraft extends StoredValidation {
  /** Exactly what was submitted, valid or not. */
  payload: unknown;
}

/** The only way a definition row leaves the feature. Row ids stay behind. */
export function toDefinitionDraft(definition: DefinitionRow): DefinitionDraft {
  return {
    payload: definition.payload,
    ...toStoredValidation(definition),
  };
}

/** The verdict on its own, for a caller that does not need the payload. */
export function toStoredValidation(definition: DefinitionRow): StoredValidation {
  return {
    valid: definition.valid,
    errors: definition.errors ?? null,
    updatedAt: definition.updatedAt.toISOString(),
  };
}

/**
 * The verdict as the console reads it. The three cases carry three different
 * things because a human has three different questions: nothing yet, what is
 * wrong, or when it last changed.
 */
export function toDefinitionStatus(stored: StoredValidation | null): DefinitionStatusDto {
  if (!stored) return { status: "none" };
  if (stored.valid) return { status: "valid", updatedAt: stored.updatedAt };

  const errors = stored.errors ?? [];
  return { status: "invalid", errorCount: errors.length, errors };
}
