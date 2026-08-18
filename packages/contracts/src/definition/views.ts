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

export const detailViewSchema = z.strictObject({
  sections: z.array(detailSectionSchema).min(1),
  /** Relationship keys rendered as embedded lists. */
  relatedLists: z.array(identifierSchema).default([]),
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
export type Views = z.infer<typeof viewsSchema>;
