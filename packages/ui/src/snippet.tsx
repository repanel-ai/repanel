import { CopyButton } from "./copy-button";

export interface SnippetProps {
  /** Exactly what lands on the clipboard, and exactly what is shown. */
  value: string;
  /** What it is, named for the control: "Copy the setup command". */
  what: string;
}

/**
 * Something to take away: a command, a config block, a secret. It scrolls
 * sideways rather than wrapping, because a wrapped command line is one nobody
 * can read back, and the copy control is the point of the box anyway.
 */
export function Snippet({ value, what }: SnippetProps) {
  return (
    <div className="flex min-w-0 items-start rounded-md border border-border bg-accent">
      <pre className="min-w-0 flex-1 overflow-x-auto py-2.5 pl-3 font-mono text-small leading-5">
        {value}
      </pre>
      {/* Outside the scrolling box rather than over it: a copy control that
          the value slides underneath is one nobody can aim at. */}
      <div className="flex h-10 shrink-0 items-center px-2.5">
        <CopyButton value={value} what={what}>
          <span className="sr-only">Copy</span>
        </CopyButton>
      </div>
    </div>
  );
}
