import type {
  DefinitionStatusDto,
  DraftStatusDto,
  PublishedDefinitionDto,
  ValidationError,
} from "@repanel/contracts";
import type { DefinitionVersionRow } from "./definition-versions.repository";
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

/** A published version as the feature passes it around, payload included. */
export interface PublishedDefinition extends PublishedDefinitionDto {
  /** The draft's payload as it stood when it was published, and never since. */
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

/** The only way a version row leaves the feature. */
export function toPublishedDefinition(published: DefinitionVersionRow): PublishedDefinition {
  return {
    version: published.version,
    publishedAt: published.publishedAt.toISOString(),
    payload: published.payload,
  };
}

/**
 * A published version as the wire sees it. The fields are named one by one
 * rather than spread, so the payload cannot follow the version out.
 */
export function toPublishedStatus(
  published: PublishedDefinition | null,
): PublishedDefinitionDto | null {
  if (!published) return null;
  return { version: published.version, publishedAt: published.publishedAt };
}

/**
 * Where a definition stands, as the console reads it: the draft the agent last
 * submitted, and the version operators are being served. Both are said, because
 * after the split neither one answers the other's question — a draft full of
 * problems over a healthy admin is the case the whole feature exists for.
 */
export function toDefinitionStatus(
  stored: StoredValidation | null,
  published: PublishedDefinition | null,
): DefinitionStatusDto {
  return {
    draft: toDraftStatus(stored),
    published: toPublishedStatus(published),
    unpublishedChanges: hasUnpublishedChanges(stored, published),
  };
}

/**
 * The verdict on the draft. The three cases carry three different things
 * because a human has three different questions: nothing yet, what is wrong, or
 * when it last changed.
 */
export function toDraftStatus(stored: StoredValidation | null): DraftStatusDto {
  if (!stored) return { status: "none" };
  if (stored.valid) return { status: "valid", updatedAt: stored.updatedAt };

  const errors = stored.errors ?? [];
  return { status: "invalid", errorCount: errors.length, errors };
}

/**
 * Whether the draft has moved since the last publication. Both timestamps are
 * written by the database's own clock, so this compares one clock with itself;
 * a draft submitted and published in the same call is not ahead of it.
 */
function hasUnpublishedChanges(
  stored: StoredValidation | null,
  published: PublishedDefinition | null,
): boolean {
  if (!stored) return false;
  if (!published) return true;
  return Date.parse(stored.updatedAt) > Date.parse(published.publishedAt);
}
