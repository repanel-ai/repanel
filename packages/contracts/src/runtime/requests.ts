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

/**
 * How many records a picker offers at once. A hard ceiling rather than a page
 * size: a list of options is read at a glance and narrowed by typing, so a
 * second page of them would be a table with none of a table's affordances. The
 * caller does not get to raise it, which is why it is here rather than in the
 * query — an options list is bounded work whoever is asking.
 */
export const OPTIONS_LIMIT = 20;

/**
 * What a picker asks: the text somebody has typed into it, or nothing at all —
 * a box that has just been opened offers the first records rather than none.
 * Strict, for the same reason a record list is: a parameter nobody recognizes
 * is a typo, and a typo answered with the first twenty of everything is worse
 * than a refusal.
 */
export const optionsQuerySchema = z.strictObject({
  /** An empty box is not a search, so it reads as no search at all. */
  q: z
    .string()
    .trim()
    .transform((term) => (term === "" ? undefined : term))
    .optional(),
});

export type OptionsQuery = z.infer<typeof optionsQuerySchema>;

/** As many events as a list read in passing shows at once. */
export const ACTIVITY_PAGE_SIZE = 5;

/**
 * What a record's activity may be asked for: which page, and how big. There is
 * nothing to search, sort or filter by — an audit log is read newest first and
 * in no other order, and a caller that could reorder it could also hide the
 * line it did not want read. Strict, like every other query this admin takes.
 */
export const activityQuerySchema = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(ACTIVITY_PAGE_SIZE),
});

export type ActivityQuery = z.infer<typeof activityQuerySchema>;
