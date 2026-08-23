import { CheckIcon, cn } from "@repanel/ui";
import type { ReactNode } from "react";
import { Link } from "react-router";
import type { SetupStep, StepKey } from "./setup-steps";

export interface SetupChecklistProps {
  steps: readonly SetupStep[];
  /** What the step you are on needs in front of it, when it needs anything. */
  extra?: Partial<Record<StepKey, ReactNode>>;
}

/**
 * The setup loop, as a list of rows in one bounded object — the runtime's table
 * frame, without a table in it.
 *
 * Only one row is drawn forward, and it is drawn forward the way the dialog's
 * confirm is (DESIGN.md §10): the `primary` fill is spent where there is
 * exactly one thing to go ahead with. A step that is done keeps its full
 * weight, because it is a fact and not something to skim past.
 */
export function SetupChecklist({ steps, extra }: SetupChecklistProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {steps.map((step, index) => (
        <div
          key={step.key}
          className={cn(
            "flex items-start gap-2.5 px-4 py-3",
            index > 0 && "border-t border-border",
          )}
        >
          <Mark step={step} index={index} />

          <div className="min-w-0 flex-1">
            <p className={cn("text-body font-medium", step.state === "todo" && "text-muted-foreground")}>
              {step.title}
            </p>
            <p className="mt-0.5 text-small text-muted-foreground">{step.note}</p>
            {step.state === "current" && extra?.[step.key]}
          </div>

          {/*
            * One way forward per row. A step that is done keeps a quiet way
            * back to the page that owns it; the step you are on shows the
            * link only when it has nothing better to offer, because the
            * command below it is already the way forward.
            */}
          {(step.state === "done" || (step.state === "current" && !extra?.[step.key])) && (
            <Link
              to={step.goTo.to}
              className="flex h-control flex-none items-center rounded-md px-2 text-body font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45"
            >
              {step.goTo.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/** Done, next, or not yet: a tick, the step's number in the accent, or a ring. */
function Mark({ step, index }: { step: SetupStep; index: number }) {
  const shared = "mt-0.5 grid size-[19px] flex-none place-items-center rounded-full text-micro font-semibold";

  if (step.state === "done") {
    return (
      <span aria-hidden className={cn(shared, "border border-positive-line bg-positive-soft text-positive-text")}>
        <CheckIcon className="size-2.5" strokeWidth={3} />
      </span>
    );
  }
  if (step.state === "current") {
    return (
      <span aria-hidden className={cn(shared, "bg-primary text-primary-foreground")}>
        {index + 1}
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(shared, "border border-input text-muted-foreground")}>
      {index + 1}
    </span>
  );
}
