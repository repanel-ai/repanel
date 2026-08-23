/**
 * The product's one date shape, in the console: `23 Aug 2026`, in UTC, never
 * the reader's locale (DECISIONS #030). Two surfaces need it — when a token was
 * last used, and when a definition was last submitted — so it is written once
 * here rather than twice in the features that show it.
 *
 * The runtime's `DateValue` is a different job: it renders a value out of a
 * customer's own column, and carries the rules about zones that go with that.
 * These are RePanel's own timestamps, and they always arrive as ISO 8601.
 */
const DAY = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const MOMENT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** `23 Aug 2026`. A value that is not a date is shown as it arrived. */
export function formatDay(value: string): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? value : DAY.format(at);
}

/** `23 Aug 2026 04:31 UTC`, for a moment worth reading to the minute. */
export function formatMoment(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  return `${MOMENT.format(at).replace(",", "")} UTC`;
}
