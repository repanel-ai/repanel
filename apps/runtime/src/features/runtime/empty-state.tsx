import { Button, EmptyPanel } from "@repanel/ui";

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
    <EmptyPanel
      title={isNarrowed ? "No matches" : "No records yet"}
      description={
        isNarrowed
          ? "No records match the current search and filters."
          : `Nothing has been added to ${plural} yet.`
      }
      action={
        isNarrowed && (
          <Button variant="outline" onClick={onClear}>
            Clear filters
          </Button>
        )
      }
    />
  );
}
