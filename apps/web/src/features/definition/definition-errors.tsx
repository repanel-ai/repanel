import type { ValidationError } from "@repanel/contracts";

/**
 * Every problem with the submitted definition, as the validator wrote them.
 * The hint is shown rather than kept for the agent: it is the whole payoff of
 * #008's error design, and a human reading it can tell whether the agent is
 * about to fix the right thing.
 */
export function DefinitionErrors({ errors }: { errors: readonly ValidationError[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {errors.map((error) => (
        <li
          key={`${error.path}:${error.message}`}
          className="flex flex-col gap-1 rounded-md border border-border bg-accent px-3 py-2.5"
        >
          <code className="font-mono text-small text-muted-foreground">{error.path}</code>
          <p className="text-body">{error.message}</p>
          <p className="text-body text-muted-foreground">{error.hint}</p>
        </li>
      ))}
    </ul>
  );
}
