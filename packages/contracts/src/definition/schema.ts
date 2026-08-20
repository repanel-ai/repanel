import { z } from "zod";
import { actionSchema } from "./actions.js";
import { fieldSchema } from "./fields.js";
import { DEFAULT_ICON, iconNameSchema } from "./icons.js";
import { identifierSchema } from "./identifier.js";
import { viewsSchema } from "./views.js";

export const SCHEMA_VERSION = "0.1";

export const navigationGroupSchema = z.strictObject({
  label: z.string().min(1),
  /** Ordered resource keys. */
  resources: z.array(identifierSchema).min(1),
});

export const relationshipSchema = z.strictObject({
  key: identifierSchema,
  kind: z.enum(["belongsTo", "hasMany"]),
  /** Key of the resource on the other end. */
  target: identifierSchema,
  /**
   * `belongsTo` — the foreign key column on this resource.
   * `hasMany` — the foreign key column on the target resource.
   */
  foreignKey: identifierSchema,
});

export const resourceSchema = z.strictObject({
  key: identifierSchema,
  label: z.strictObject({
    singular: z.string().min(1),
    plural: z.string().min(1),
  }),
  /** v0 binds a resource to a single postgres table. */
  source: z.strictObject({ table: identifierSchema }),
  primaryKey: identifierSchema,
  /**
   * The field a record is displayed by, wherever the admin names one rather
   * than showing it: a relation column, a related list, a link. Falls back to
   * `primaryKey`, which is always there and almost never what a human
   * recognizes a record by.
   */
  labelField: identifierSchema.optional(),
  /**
   * The mark the navigation draws this resource with, out of a fixed
   * vocabulary. Left out it is the generic one, which is what every resource
   * looked like before the vocabulary existed.
   */
  icon: iconNameSchema.default(DEFAULT_ICON),
  /** v0 has no write configuration beyond actions, so this is always true. */
  readOnly: z.literal(true).default(true),
  fields: z.array(fieldSchema).min(1),
  relationships: z.array(relationshipSchema).default([]),
  views: viewsSchema,
  actions: z.array(actionSchema).default([]),
});

export const definitionSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  app: z.strictObject({ name: z.string().min(1) }),
  navigation: z.array(navigationGroupSchema).min(1),
  resources: z.array(resourceSchema).min(1),
});

/** A validated definition: defaults applied, ready for the runtime. */
export type Definition = z.infer<typeof definitionSchema>;
/** A definition as authored, before defaults are applied. */
export type DefinitionInput = z.input<typeof definitionSchema>;
export type Resource = z.infer<typeof resourceSchema>;
export type Relationship = z.infer<typeof relationshipSchema>;

/**
 * The field a record is displayed by. The default is resolved here rather than
 * in the schema so that an unset `labelField` never reports a problem at a path
 * the author did not write — a resource with a broken `primaryKey` has one
 * mistake, and should be told about one.
 */
export function labelFieldOf(resource: Resource): string {
  return resource.labelField ?? resource.primaryKey;
}

export type RelationshipKind = Relationship["kind"];
export type NavigationGroup = z.infer<typeof navigationGroupSchema>;
