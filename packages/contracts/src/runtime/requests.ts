import { z } from "zod";
import { identifierSchema } from "../definition/identifier.js";

export const DEFAULT_PAGE_SIZE = 25;

/** As many rows as one screen can want. Asking for more is refused, not trimmed. */
export const MAX_PAGE_SIZE = 100;

/** A `dateRange` filter: one end, the other, or both. */
const dateRangeFilterSchema = z.strictObject({
  from: z.string().min(1).optional(),
  to: z.string().min(1).optional(),
});

export type DateRangeFilter = z.infer<typeof dateRangeFilterSchema>;

/** What one filter carries: a value, or the ends of a range. */
export type RecordFilterValue = string | DateRangeFilter;

/**
 * What a record list may be asked for. Every value arrives as text — this is a
 * query string, not a JSON body — so the numbers are coerced rather than
 * declared. Strict: a query parameter nobody recognizes is a typo, and a typo
 * answered with the first page of everything is worse than a refusal.
 */
export const listRecordsQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  /** An empty box is not a search, so it reads as no search at all. */
  search: z
    .string()
    .trim()
    .transform((term) => (term === "" ? undefined : term))
    .optional(),
  sort: identifierSchema.optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  /** `filter[<field>]=<value>`, or `filter[<field>][from|to]=<value>`. */
  filter: z.record(identifierSchema, z.union([z.string(), dateRangeFilterSchema])).optional(),
});

export type ListRecordsQuery = z.infer<typeof listRecordsQuerySchema>;
