import type { ValidationError } from "./errors.js";
import { checkNavigation } from "./navigation-checks.js";
import { duplicateKey } from "./reference-errors.js";
import { checkResource } from "./resource-checks.js";
import type { Definition, Resource } from "./schema.js";

/**
 * The checks zod cannot express: every key a definition refers to must exist,
 * and the reference must make sense for the type of thing it points at.
 * Resolves the resource keys once, checks that navigation and resources line
 * up, then hands each resource to its own checks. Runs only on a structurally
 * valid definition.
 */
export function checkReferences(definition: Definition): ValidationError[] {
  const errors: ValidationError[] = [];
  const resources = new Map<string, Resource>();

  definition.resources.forEach((resource, index) => {
    if (resources.has(resource.key)) {
      errors.push(duplicateKey(`resources[${index}].key`, "resource", resource.key, "the definition"));
      return;
    }
    resources.set(resource.key, resource);
  });

  const resourceKeys = [...resources.keys()];

  errors.push(...checkNavigation(definition, resources, resourceKeys));

  definition.resources.forEach((resource, index) => {
    errors.push(...checkResource(resource, `resources[${index}]`, resources, resourceKeys));
  });

  return errors;
}
