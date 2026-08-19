import { Button } from "@repanel/ui";

export interface EmptyStateProps {
  /** Whether a search or a filter is the reason there is nothing here. */
  isNarrowed: boolean;
  /** What this resource is called, in the plural. */
  plural: string;
  onClear: () => void;
}

/**
 * Nothing to show, and which kind of nothing it is. An operator who filtered
 * their way into an empty table is told so, and given the way back; a table
 * that is simply empty says that instead of blaming a filter nobody set.
 */
export function EmptyState({ isNarrowed, plural, onClear }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-4 py-14 text-center">
      <p className="text-body font-medium">{isNarrowed ? "No matches" : "No records yet"}</p>
      <p className="max-w-sm text-body text-muted-foreground">
        {isNarrowed
          ? "No records match the current search and filters."
          : `Nothing has been added to ${plural} yet.`}
      </p>
      {isNarrowed && (
        <Button variant="outline" onClick={onClear} className="mt-2">
          Clear filters
        </Button>
      )}
    </div>
  );
}
