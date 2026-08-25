import { z } from "zod";
import { actionSchema } from "./actions.js";
import { fieldSchema, type Field } from "./fields.js";
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

/**
 * Which writes a resource offers the admin. Both are false unless the author
 * says otherwise: an admin that can read is useful and an admin that can write
 * is dangerous, so the dangerous half is asked for by name (DECISIONS #007).
 *
 * The two are separate because they are separate decisions — a table whose rows
 * are created by the application and corrected by an operator offers `update`
 * and not `create`. Deletion is deliberately absent, and is additive when the
 * audit log that makes it accountable exists.
 */
export const writesSchema = z
  .strictObject({
    create: z.boolean().default(false),
    update: z.boolean().default(false),
  })
  .default({ create: false, update: false });

export type Writes = z.infer<typeof writesSchema>;

/**
 * Where a new record's primary key comes from.
 *
 * `database` — the column has a default and the admin never sends a key: the
 * insert omits the column and reports back whatever the database issued.
 * `client` — the key is part of what a record is, so the form asks for it and
 * the insert writes it. A slug, an externally-issued account number, an id the
 * application mints: keys somebody has to decide rather than a column can.
 *
 * It is a declaration of intent and nothing more. The definition never names a
 * generation algorithm — no `uuid`, no sequence, no prefix — because that is
 * the database's own business and RePanel writing it down would be RePanel
 * guessing at it (DECISIONS #059).
 */
export const primaryKeyGenerationSchema = z.enum(["database", "client"]);

export type PrimaryKeyGeneration = z.infer<typeof primaryKeyGenerationSchema>;

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
   * Where a new record's key comes from. Left out it is `database`, which is
   * what every resource meant before this existed: the column has a default and
   * nothing types a key. Only meaningful on a resource that creates records.
   */
  primaryKeyGeneration: primaryKeyGenerationSchema.optional(),
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
  /**
   * What every resource said before `writes` existed, and still says: this
   * resource offers no writes. Kept so that definitions written against v0
   * validate unchanged; a resource that offers writes leaves it out. Only
   * `true` means anything — `readOnly: false` offers nothing, and the
   * referential pass says so in this package's own words rather than letting a
   * literal failure hint at the wrong fix.
   */
  readOnly: z.boolean().optional(),
  fields: z.array(fieldSchema).min(1),
  /** The writes this resource offers. Absent means none, which is the default. */
  writes: writesSchema,
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

/**
 * Where this resource's keys come from. The default is resolved here rather
 * than in the schema for the same reason `labelField`'s is: an unset
 * `primaryKeyGeneration` must never report a problem at a path the author did
 * not write, and the referential pass has to be able to tell a declaration from
 * a default.
 */
export function primaryKeyGenerationOf(resource: Resource): PrimaryKeyGeneration {
  return resource.primaryKeyGeneration ?? "database";
}

/** Whether anything at all may be written to this resource from the admin. */
export function offersWrites(resource: Resource): boolean {
  return resource.writes.create || resource.writes.update;
}

/**
 * The fields the author marked `editable`, in the order the resource declares
 * them. It is the declaration and not the verdict: whether a write may actually
 * carry one is `refuseWriteTo`'s answer, which reads the resource as well as the
 * field and differs between a create and an update.
 */
export function editableFields(resource: Resource): Field[] {
  return resource.fields.filter((field) => field.editable);
}

export type RelationshipKind = Relationship["kind"];
export type NavigationGroup = z.infer<typeof navigationGroupSchema>;
