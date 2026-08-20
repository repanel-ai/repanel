import { Button } from "@repanel/ui";
import type { DataFace } from "./use-data-face";

/**
 * TEMPORARY, and dev-only — it is not rendered in a built admin. The label is
 * itself set in the data face, so the control shows the answer it is asking
 * about (DESIGN.md BUILD REQUIREMENT 5). It goes with the decision.
 */
export function DataFaceToggle({ face, onToggle }: { face: DataFace; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={
        face === "mono" ? "Set data in the sans face" : "Set data in the monospace face"
      }
      title={`Data face: ${face}`}
      className="font-data text-body font-medium text-utility-foreground hover:text-foreground"
    >
      01
    </Button>
  );
}
