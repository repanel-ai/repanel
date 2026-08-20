import type { Field, RecordValue } from "@repanel/contracts";
import { Badge, CheckIcon, CircleIcon, JsonBlock, NoValue, cn } from "@repanel/ui";
import type { ReactNode } from "react";
import { DateValue } from "./date-value";
import { NumberValue } from "./number-value";
import { RelationLink } from "./relation-link";

export interface DetailValueProps {
  projectKey: string;
  /** What the definition says this value is. Nothing else decides. */
  field: Field;
  value: RecordValue;
  /** Whether this field is the record's own key rather than a value about it. */
  isIdentity: boolean;
}

/**
 * One value on a record's own page. It says the same things the table cell says
 * — the same badge, the same dotted relation, the same day in the same shape —
 * at the length a detail view has room for: prose keeps its line breaks, a
 * structured value can be opened, and a timestamp shows the clock instead of
 * hiding it behind a hover.
 */
export function DetailValue({ projectKey, field, value, isIdentity }: DetailValueProps) {
  if (value === null || value === undefined) return <NoValue />;

  switch (field.type) {
    case "enum":
      return <Badge tone={field.tones[String(value)]}>{String(value)}</Badge>;

    case "relation":
      return <RelationLink projectKey={projectKey} target={field.target} value={value} />;

    case "boolean":
      return <YesNo yes={value === true} />;

    case "date":
    case "dateTime":
      return <DateValue value={String(value)} hasTime={field.type === "dateTime"} showClock />;

    case "number":
      return <NumberValue value={value} isIdentity={isIdentity} />;

    case "json":
      return <JsonBlock value={value} />;

    case "longText":
      // The line breaks somebody typed are part of what they wrote.
      return <p className="whitespace-pre-wrap">{String(value)}</p>;

    case "email":
      return <SafeLink href={`mailto:${String(value)}`}>{String(value)}</SafeLink>;

    case "url":
      return (
        <SafeLink href={String(value)} away>
          {String(value)}
        </SafeLink>
      );

    default:
      return <span className={isIdentity ? "font-data" : ""}>{String(value)}</span>;
  }
}

/** The answer in a word, with the mark the table draws it as. */
function YesNo({ yes }: { yes: boolean }) {
  const Glyph = yes ? CheckIcon : CircleIcon;
  return (
    <span className={cn("inline-flex items-center gap-1.5", yes ? "text-foreground" : "text-muted-foreground")}>
      <Glyph className="size-3.5 shrink-0" />
      {yes ? "Yes" : "No"}
    </span>
  );
}

/**
 * Somewhere the record points. A solid underline, because that is what a link
 * wears here and the dotted rule is spoken for by relations (DESIGN.md §5).
 *
 * The scheme is checked first. The value came out of the customer's database,
 * and a `url` column holds `javascript:` as easily as `https:` — rendering that
 * as something an operator clicks would be handing a stranger their session.
 * Anything this cannot vouch for is shown as the text it is.
 */
function SafeLink({ href, away = false, children }: { href: string; away?: boolean; children: ReactNode }) {
  const safe = vouchedFor(href);
  if (!safe) return <span className="font-data break-all">{children}</span>;

  return (
    <a
      href={safe}
      {...(away ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={cn(
        "rounded-sm font-data break-all underline decoration-muted-foreground underline-offset-[3px]",
        "outline-none hover:decoration-current focus-visible:ring-3 focus-visible:ring-ring/45",
      )}
    >
      {children}
    </a>
  );
}

const SAFE_SCHEMES: ReadonlySet<string> = new Set(["http:", "https:", "mailto:"]);

function vouchedFor(href: string): string | undefined {
  try {
    return SAFE_SCHEMES.has(new URL(href).protocol) ? href : undefined;
  } catch {
    // Not a URL at all — which is a value to read, not an address to follow.
    return undefined;
  }
}
