import { formatList, type Definition, type Resource } from "@repanel/contracts";
import { NotFoundError } from "./errors.js";

/** Everything a definition declares, by key, so a route can name one. */
export function indexResources(definition: Definition): ReadonlyMap<string, Resource> {
  return new Map(definition.resources.map((resource) => [resource.key, resource]));
}

/**
 * The resource a key names. A miss is answered with what this admin does have —
 * a resource key is written by hand into a URL far more often than a definition
 * is.
 */
export function requireResource(
  resources: ReadonlyMap<string, Resource>,
  key: string,
): Resource {
  const resource = resources.get(key);
  if (!resource) {
    throw new NotFoundError(
      `This admin has no resource \`${key}\`. Resources: ${formatList([...resources.keys()])}.`,
    );
  }
  return resource;
}
