import { useId, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./class-names";

/**
 * The frame both halves of a record share: a label column and a value column
 * inside one bordered panel. It is written once because reading a record and
 * editing one are the same page with the values in different clothes — a form
 * whose rows sat on a different grid would say they were different screens.
 *
 * Both cells share a 20px line box and 8px of air, which lands an ordinary row
 * on the table's own 36px rhythm and lets a long value grow in whole lines.
 */
const GRID = [
  "grid grid-cols-[minmax(6rem,11rem)_minmax(0,1fr)] overflow-hidden rounded-lg border border-border",
  // The final pair's rule would draw the frame's own edge twice.
  "[&>:nth-last-child(-n+2)]:border-b-0",
].join(" ");

/** The rule under every cell but the last pair's, and the air inside one. */
const CELL = "border-b border-border py-2";

/**
 * Label and value, paired. It is a real description list, so the pairing is in
 * the markup rather than only in the columns: a screen reader reads "Email,
 * maya@example.com" without being told how the grid was laid out.
 */
export function Fields({ className, ...props }: HTMLAttributes<HTMLDListElement>) {
  return <dl data-slot="fields" className={cn(GRID, className)} {...props} />;
}

export interface FieldRowProps {
  /** What the definition calls this field. */
  label: string;
  children: ReactNode;
}

/** One field: what it is called, and what it holds. */
export function FieldRow({ label, children }: FieldRowProps) {
  return (
    <>
      <dt className={cn(CELL, "pr-2 pl-2.5 text-small leading-5 text-muted-foreground")}>{label}</dt>
      <dd className={cn(CELL, "min-w-0 pr-2.5 pl-2 text-body leading-5")}>{children}</dd>
    </>
  );
}

/** The same frame, holding controls instead of values. */
export function FormFields({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="form-fields" className={cn(GRID, className)} {...props} />;
}

/**
 * What a row hands the control it holds. Spread onto the control and the wiring
 * is done: it is named by the label, it says whether it must be answered, and
 * when something is wrong with it, it points at the sentence saying so.
 */
export interface FormControlProps {
  id: string;
  required: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

export interface FormFieldRowProps {
  /** What the definition calls this field. */
  label: string;
  /** Whether the field must carry a value. */
  required?: boolean;
  /** What is wrong with the value, in the words of whatever refused it. */
  error?: string;
  /** Something true about the value that is not a problem with it. */
  note?: ReactNode;
  children: (control: FormControlProps) => ReactNode;
}

/**
 * One field being filled in: what it is called, the control that answers it,
 * and what is wrong with the answer.
 *
 * The control arrives through a function rather than as a node because the row
 * is the only thing that knows the ids — its own label's and its message's —
 * and a call site that has to remember to wire `aria-describedby` is a call
 * site that will eventually forget. Handing the props down is the whole of it.
 */
export function FormFieldRow({ label, required = false, error, note, children }: FormFieldRowProps) {
  const id = useId();
  const problemId = `${id}-problem`;
  const noteId = `${id}-note`;

  /**
   * Everything said about this value, in the order it is read. Both are
   * described rather than labelled: what a field is called does not change
   * because something is wrong with it, or because there is something worth
   * knowing about what is in it.
   */
  const describedBy = [note !== undefined ? noteId : undefined, error ? problemId : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className={cn(CELL, "pr-2 pl-2.5 text-small leading-5 text-muted-foreground")}>
        <label htmlFor={id}>{label}</label>
        {/* The mark sits beside the label rather than inside it: the fact
            itself is on the control, where a screen reader already reads it,
            and a decoration inside the label would be part of the name the
            field is called by. */}
        {required && (
          <span aria-hidden="true" className="ml-1">
            *
          </span>
        )}
      </div>
      <div className={cn(CELL, "flex min-w-0 flex-col gap-1.5 pr-2.5 pl-2 text-body")}>
        {children({
          id,
          required,
          ...(error ? { "aria-invalid": true } : {}),
          ...(describedBy === "" ? {} : { "aria-describedby": describedBy }),
        })}
        {note !== undefined && (
          <p id={noteId} className="text-small text-muted-foreground">
            {note}
          </p>
        )}
        {error && (
          <p id={problemId} role="alert" className="text-small text-destructive-text">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
