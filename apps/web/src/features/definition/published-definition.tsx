import type { PublishedDefinitionDto } from "@repanel/contracts";
import { Badge, Card, buttonClasses } from "@repanel/ui";
import { formatMoment } from "../../lib/format-date";

export interface PublishedDefinitionProps {
  published: PublishedDefinitionDto | null;
  /** Whether the agent has submitted something since this version went live. */
  unpublishedChanges: boolean;
  adminUrl: string | null;
}

/**
 * What operators are being served, at the top of the page because it is the
 * only thing on it that is about them. Everything below is the definition being
 * worked on, and work in progress is not what an admin serves.
 */
export function PublishedDefinition({
  published,
  unpublishedChanges,
  adminUrl,
}: PublishedDefinitionProps) {
  if (!published) {
    return (
      <Card className="flex flex-col gap-1 p-5">
        <span className="flex items-center gap-2 text-body font-medium">
          Nothing published yet
          <Badge>Not live</Badge>
        </span>
        <span className="text-body text-muted-foreground">
          Your admin answers once a definition is published. Publishing is what puts one in
          front of an operator, and until then there is nothing for them to open.
        </span>
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2 text-body font-medium">
          Version {published.version}
          <Badge tone="positive">Live</Badge>
        </span>
        <span className="text-body text-muted-foreground">
          Published {formatMoment(published.publishedAt)}
          {unpublishedChanges && " · your agent has submitted a newer draft since"}
        </span>
      </div>

      {adminUrl && (
        <a className={buttonClasses()} href={adminUrl}>
          Open admin
        </a>
      )}
    </Card>
  );
}
