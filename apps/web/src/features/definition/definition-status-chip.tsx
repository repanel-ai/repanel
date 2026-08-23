import type { DefinitionStatusDto } from "@repanel/contracts";
import { Badge, Skeleton, type BadgeTone } from "@repanel/ui";
import { useDefinitionStatus } from "./use-definition-status";

/**
 * How a definition's three states are said, everywhere they are said.
 *
 * Choosing tones here is not the guess #029 refuses: that rule is about a
 * customer's data, where nothing in the definition says whether `pending` is
 * grave. A definition that failed validation is RePanel's own vocabulary, and
 * RePanel knows exactly how grave it is.
 */
const CHIPS: Record<DefinitionStatusDto["status"], { tone: BadgeTone; label: string }> = {
  none: { tone: "neutral", label: "No definition" },
  invalid: { tone: "critical", label: "Invalid" },
  valid: { tone: "positive", label: "Valid" },
};

/** Where a project's definition stands, in one word, on a list of projects. */
export function DefinitionStatusChip({ projectId }: { projectId: string }) {
  const status = useDefinitionStatus(projectId);

  if (!status.data) return <Skeleton className="h-[19px] w-24" />;

  const chip = CHIPS[status.data.status];
  return <Badge tone={chip.tone}>{chip.label}</Badge>;
}
