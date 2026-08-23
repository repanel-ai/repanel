import { Button } from "@repanel/ui";
import { Snippet } from "./snippet";

export interface MintedTokenProps {
  label: string;
  token: string;
  onDismiss: () => void;
}

/**
 * The one copy of a token there will ever be. Only its digest is stored, so
 * this panel is not a convenience — it is the token's entire lifetime on screen,
 * and it says so plainly rather than leaving someone to find out later.
 */
export function MintedToken({ label, token, onDismiss }: MintedTokenProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-attention-line bg-attention-soft p-3.5">
      <p className="text-body font-medium text-attention-text">
        Copy {label} now — you will not see it again
      </p>
      <Snippet value={token} what="the agent token" />
      <p className="text-body text-foreground">
        RePanel stores only a digest of this token. If it is lost, mint another one.
      </p>
      <div>
        <Button variant="outline" onClick={onDismiss}>
          I have copied it
        </Button>
      </div>
    </div>
  );
}
