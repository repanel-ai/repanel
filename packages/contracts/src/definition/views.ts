import { z } from "zod";
import { identifierSchema } from "./identifier.js";

export const FILTER_KINDS = ["enum", "boolean", "dateRange", "relation"] as const;

export const filterSchema = z.strictObject({
  field: identifierSchema,
  kind: z.enum(FILTER_KINDS),
});

export const tableViewSchema = z.strictObject({
  /** Ordered field keys. */
  columns: z.array(identifierSchema).min(1),
  defaultSort: z.strictObject({
    field: identifierSchema,
    direction: z.enum(["asc", "desc"]),
  }),
  /** Field keys the free-text search box queries. */
  search: z.array(identifierSchema).default([]),
  filters: z.array(filterSchema).default([]),
});

export const detailSectionSchema = z.strictObject({
  title: z.string().min(1),
  fields: z.array(identifierSchema).min(1),
});

/**
 * Whether a record's related records are read alongside it or reached from it.
 *
 * `inline` stacks them under the record's own sections: the related records
 * are part of reading the record. `tabs` gives the sections one tab and every
 * related list its own: the related records are their own subject, reached
 * deliberately. Which is true is a fact about the resource that the runtime
 * cannot see — a user's orders are the point of opening the user, and a
 * setting's audit trail is not.
 */
export const RELATED_LAYOUTS = ["inline", "tabs"] as const;

export const detailViewSchema = z.strictObject({
  sections: z.array(detailSectionSchema).min(1),
  /** Relationship keys rendered as embedded lists. */
  relatedLists: z.array(identifierSchema).default([]),
  relatedLayout: z.enum(RELATED_LAYOUTS).default("inline"),
});

export const viewsSchema = z.strictObject({
  table: tableViewSchema,
  detail: detailViewSchema,
});

export type Filter = z.infer<typeof filterSchema>;
export type FilterKind = Filter["kind"];
export type TableView = z.infer<typeof tableViewSchema>;
export type DetailSection = z.infer<typeof detailSectionSchema>;
export type DetailView = z.infer<typeof detailViewSchema>;
export type RelatedLayout = DetailView["relatedLayout"];
export type Views = z.infer<typeof viewsSchema>;
