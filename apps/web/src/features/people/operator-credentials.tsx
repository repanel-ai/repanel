import { Button, Snippet } from "@repanel/ui";

export interface OperatorCredentialsProps {
  email: string;
  password: string;
  onDismiss: () => void;
}

/**
 * The one copy of an operator's password there will ever be. RePanel stores
 * only its hash, exactly as it does for an agent token, so this panel is not a
 * convenience — it is the password's entire lifetime on screen.
 *
 * It says what to do when it is lost, because there is nothing else to do: no
 * email is sent, so there is no reset link, and an owner who was told to "wait
 * for the email" would be waiting for something that does not exist.
 */
export function OperatorCredentials({ email, password, onDismiss }: OperatorCredentialsProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-attention-line bg-attention-soft p-3.5">
      <p className="text-body font-medium text-attention-text">
        Copy this password now — you will not see it again
      </p>
      <p className="text-body text-foreground">
        Send it to {email} yourself. They sign in with it at RePanel, and it opens this admin and
        nothing else.
      </p>
      <Snippet value={password} what="the operator password" />
      <p className="text-body text-foreground">
        RePanel stores only a hash of it. If it is lost, revoke them and add them again.
      </p>
      <div>
        <Button variant="outline" onClick={onDismiss}>
          I have copied it
        </Button>
      </div>
    </div>
  );
}
