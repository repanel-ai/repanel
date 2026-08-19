import type { ValidationError } from "./errors.js";
import { saasDefinition } from "./fixtures/index.js";
import type { Definition, DefinitionInput } from "./schema.js";
import { validateDefinition } from "./validate.js";

/**
 * How the check specs write a case: take the reference definition, break one
 * thing in it, and read what validation says. Every spec for a check module
 * starts from the same known-good draft, so a case describes its own problem
 * and nothing else.
 */

export type DraftResource = DefinitionInput["resources"][number];
export type DraftField = DraftResource["fields"][number];

export function errorsFor(mutate: (draft: DefinitionInput) => void): ValidationError[] {
  const draft = structuredClone(saasDefinition);
  mutate(draft);
  const result = validateDefinition(draft);
  if (result.valid) throw new Error("expected the definition to be invalid");
  return result.errors;
}

export function errorAt(errors: ValidationError[], path: string): ValidationError {
  const error = errors.find((candidate) => candidate.path === path);
  if (!error) throw new Error(`no error at \`${path}\`; got:\n${JSON.stringify(errors, null, 2)}`);
  return error;
}

export function validFor(mutate: (draft: DefinitionInput) => void): Definition {
  const draft = structuredClone(saasDefinition);
  mutate(draft);
  const result = validateDefinition(draft);
  if (!result.valid) {
    throw new Error(`expected a valid definition, got:\n${JSON.stringify(result.errors, null, 2)}`);
  }
  return result.definition;
}

export function fieldIn(resource: DraftResource, key: string): DraftField {
  const found = resource.fields.find((field) => field.key === key);
  if (!found) throw new Error(`the fixture's resource has no field \`${key}\``);
  return found;
}

export function resourceIn(draft: DefinitionInput, key: string): DraftResource {
  const found = draft.resources.find((resource) => resource.key === key);
  if (!found) throw new Error(`the fixture has no resource \`${key}\``);
  return found;
}
