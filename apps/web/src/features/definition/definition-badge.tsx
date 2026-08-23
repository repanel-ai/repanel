import type { DefinitionStatusDto } from "@repanel/contracts";
import { Badge, type BadgeTone } from "@repanel/ui";

/**
 * How a definition's three states are said, everywhere they are said.
 *
 * Choosing tones here is not the guess DECISIONS #029 refuses: that rule is
 * about a customer's data, where nothing in the definition says whether
 * `pending` is grave. A definition that failed validation is RePanel's own
 * vocabulary, and RePanel knows exactly how grave it is.
 */
const CHIPS: Record<DefinitionStatusDto["status"], { tone: BadgeTone; label: string }> = {
  none: { tone: "neutral", label: "No definition" },
  invalid: { tone: "critical", label: "Invalid" },
  valid: { tone: "positive", label: "Valid" },
};

/** Where a definition stands, in one word. */
export function DefinitionBadge({ status }: { status: DefinitionStatusDto["status"] }) {
  const chip = CHIPS[status];
  return <Badge tone={chip.tone}>{chip.label}</Badge>;
}
