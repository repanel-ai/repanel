import type { DraftStatusDto } from "@repanel/contracts";
import { Badge, type BadgeTone } from "@repanel/ui";

/**
 * How the draft's three states are said, everywhere they are said. It is the
 * draft and not the admin: whether operators have anything to open is what
 * publishing answers, and the Definition page says that separately.
 *
 * Choosing tones here is not the guess DECISIONS #029 refuses: that rule is
 * about a customer's data, where nothing in the definition says whether
 * `pending` is grave. A definition that failed validation is RePanel's own
 * vocabulary, and RePanel knows exactly how grave it is.
 */
const CHIPS: Record<DraftStatusDto["status"], { tone: BadgeTone; label: string }> = {
  none: { tone: "neutral", label: "No definition" },
  invalid: { tone: "critical", label: "Invalid" },
  valid: { tone: "positive", label: "Valid" },
};

/** Where a definition stands, in one word. */
export function DefinitionBadge({ status }: { status: DraftStatusDto["status"] }) {
  const chip = CHIPS[status];
  return <Badge tone={chip.tone}>{chip.label}</Badge>;
}
