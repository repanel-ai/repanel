import { Skeleton } from "@repanel/ui";
import { DefinitionBadge } from "./definition-badge";
import { useDefinitionStatus } from "./use-definition-status";

/**
 * Where a project's definition stands, on a list of projects — the badge, with
 * the asking attached, because a card on the list has no status of its own to
 * hand it.
 */
export function DefinitionStatusChip({ projectId }: { projectId: string }) {
  const status = useDefinitionStatus(projectId);

  if (!status.data) return <Skeleton className="h-[19px] w-24" />;
  return <DefinitionBadge status={status.data.status} />;
}
