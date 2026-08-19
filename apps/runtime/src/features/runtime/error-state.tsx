import { Button } from "@repanel/ui";

export interface ErrorStateProps {
  title: string;
  /** What the API said. The runtime shows it rather than a message of its own. */
  message: string;
  onRetry?: () => void;
}

/**
 * Something did not come back. It is said in the badge language's tinted
 * treatment — the same red as a state, at the same weight — because a failed
 * request is a condition to be read, not an alarm to be startled by.
 */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex max-w-2xl flex-col items-start gap-2 rounded-lg border border-destructive-line bg-destructive-soft px-4 py-3.5"
    >
      <p className="text-body font-medium text-destructive-text">{title}</p>
      <p className="text-body text-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  );
}
