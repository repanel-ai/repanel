import type { Field, WriteMode } from "@repanel/contracts";
import {
  FormFieldRow,
  FormSelect,
  Input,
  Textarea,
  cn,
  type FormControlProps,
} from "@repanel/ui";
import { useState, type ReactNode } from "react";
import type { DraftValue } from "./form-draft";
import { RelationPicker } from "./relation-picker";

export interface FormFieldProps {
  /** Which admin this is, so a relation can ask what it may point at. */
  projectKey: string;
  /** What the definition says this field is. Nothing else decides the control. */
  field: Field;
  /** Which write this is. A record being made has no value to have emptied. */
  mode: WriteMode;
  value: DraftValue;
  /** What the relation the record came with is called, where it has a name. */
  valueLabel?: string | null;
  /** What is wrong with this value, in the words of whatever refused it. */
  error?: string;
  /** Something true about the value that is not a problem with it. */
  note?: ReactNode;
  onChange: (value: DraftValue) => void;
}

/**
 * One field being filled in. Which control it gets is read out of the field's
 * declared type and out of nothing else — the same rule the read view keeps
 * (`DetailValue`), which is what makes a form and a record two views of one
 * definition rather than two guesses at it.
 */
export function FormField({
  projectKey,
  field,
  mode,
  value,
  valueLabel,
  error,
  note,
  onChange,
}: FormFieldProps) {
  return (
    <FormFieldRow label={field.label} required={field.required} error={error} note={note}>
      {(control) => (
        <FieldControl
          projectKey={projectKey}
          field={field}
          mode={mode}
          value={value}
          valueLabel={valueLabel}
          control={control}
          onChange={onChange}
        />
      )}
    </FormFieldRow>
  );
}

/**
 * The values a `<select>` can carry are all strings, so nothing is one of them.
 * The empty option is the mark the whole admin says nothing with.
 */
const NOTHING = "";

/** Types whose value space has an empty string in it. */
const TEXT_TYPES: ReadonlySet<Field["type"]> = new Set(["text", "longText", "email", "url"]);

/** Types whose value is machine-shaped, and is set in the data face (DESIGN.md §3). */
const DATA_TYPES: ReadonlySet<Field["type"]> = new Set([
  "number",
  "date",
  "dateTime",
  "email",
  "url",
  "relation",
]);

function FieldControl({
  projectKey,
  field,
  mode,
  value,
  valueLabel,
  control,
  onChange,
}: {
  projectKey: string;
  field: Field;
  mode: WriteMode;
  value: DraftValue;
  valueLabel?: string | null;
  control: FormControlProps;
  onChange: (value: DraftValue) => void;
}) {
  /**
   * Whether this field is showing the em-dash rather than a box — which is a
   * thing the operator says, not a thing the value implies. It starts as
   * whether the record holds nothing, and after that only the two marks move
   * it: pressing the dash asks for a box, pressing it back gives the box up.
   *
   * Emptying the box does *not* collapse it. A date has no empty value, so an
   * emptied date box holds nothing — but it is a box somebody is typing into,
   * and taking it out from under them mid-edit is the one thing this control
   * must not do.
   */
  const [showingNothing, setShowingNothing] = useState(value === null);
  /** Whether the operator has moved between the two, so focus follows them. */
  const [moved, setMoved] = useState(false);

  const swap = (toNothing: boolean) => {
    setShowingNothing(toNothing);
    setMoved(true);
  };

  if (field.type === "enum" || field.type === "boolean") {
    return (
      <ChoiceControl field={field} mode={mode} value={value} control={control} onChange={onChange} />
    );
  }

  /**
   * The em-dash belongs to a record that exists. It is how a field holding
   * *nothing* is told from one holding an empty string — two values the write
   * path keeps apart on purpose — and a record being made holds neither: every
   * field of it is unanswered, and an unanswered field is left out of the write
   * so the column's own default stands.
   */
  const emptiable = !field.required && mode === "update";

  if (emptiable && showingNothing) {
    return <EmptyControl control={control} autoFocus={moved} onOpen={() => swap(false)} />;
  }

  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <TypedInput
        projectKey={projectKey}
        field={field}
        mode={mode}
        value={value}
        valueLabel={valueLabel}
        control={control}
        autoFocus={moved}
        onChange={onChange}
      />
      {emptiable && (
        <ClearButton
          label={field.label}
          onClear={() => {
            swap(true);
            onChange(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * The field, holding nothing — and saying so with the mark the record page uses
 * for the same fact. Pressing it puts the input there instead, which is the
 * whole of the affordance: an operator can tell a field that is empty from a
 * field holding an empty string, because only one of them is a box.
 *
 * It carries the row's own id, so the row's label names it exactly as it names
 * the input that replaces it.
 */
function EmptyControl({
  control,
  autoFocus,
  onOpen,
}: {
  control: FormControlProps;
  autoFocus: boolean;
  onOpen: () => void;
}) {
  const { required: _required, ...named } = control;

  return (
    <button
      {...named}
      type="button"
      title="No value"
      autoFocus={autoFocus}
      onClick={onOpen}
      className={cn(
        "h-control w-fit rounded-md px-1 text-left text-body text-muted-foreground",
        "outline-none transition-colors hover:text-foreground",
        "focus-visible:ring-3 focus-visible:ring-ring/45",
      )}
    >
      —
    </button>
  );
}

/** Back to nothing. The same mark, doing the same job from the other side. */
function ClearButton({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      aria-label={`Clear ${label}`}
      className={cn(
        "h-control shrink-0 rounded-md px-2 text-body text-muted-foreground",
        "outline-none transition-colors hover:text-foreground",
        "focus-visible:ring-3 focus-visible:ring-ring/45",
      )}
    >
      —
    </button>
  );
}

/**
 * A choice out of a fixed set: an enum's declared values, or the two answers a
 * boolean has. Both are closed lists, so nothing is one more entry in the list
 * rather than a control of its own — a select already knows how to offer it.
 *
 * The value on show wears the tone the definition gave it, as ink rather than
 * as a fill (DECISIONS #052). The runtime never reads severity out of a value's
 * spelling; a value the definition's `tones` map leaves out is quiet, which is
 * what every value was before the map existed (DESIGN.md §4).
 */
function ChoiceControl({
  field,
  mode,
  value,
  control,
  onChange,
}: {
  field: Field & { type: "enum" | "boolean" };
  mode: WriteMode;
  value: DraftValue;
  control: FormControlProps;
  onChange: (value: DraftValue) => void;
}) {
  const options = field.type === "enum" ? field.values : ["true", "false"];
  const chosen = value === null || value === undefined ? NOTHING : String(value);
  const tone = field.type === "enum" ? field.tones[chosen] : undefined;
  /**
   * A value the record holds that the definition has stopped listing. It gets
   * an entry of its own, because a select with no option for what is stored
   * shows something else — and misreporting a record on the one screen where
   * it is changed is worse than showing a value nobody would pick again. It is
   * quiet, like every unmapped value (DESIGN.md §4), and moving off it is what
   * takes it away.
   */
  const undeclared = chosen !== NOTHING && !options.includes(chosen);

  return (
    <FormSelect
      {...control}
      tone={tone}
      value={chosen}
      onChange={(event) => onChange(read(field, mode, event.target.value))}
    >
      {/* A field that may hold nothing offers it; one that may not shows what
          it is until it is answered, and cannot be put back that way. */}
      {!field.required && <option value={NOTHING}>—</option>}
      {field.required && chosen === NOTHING && (
        <option value={NOTHING} disabled>
          —
        </option>
      )}
      {undeclared && <option value={chosen}>{chosen}</option>}
      {options.map((option) => (
        <option key={option} value={option}>
          {field.type === "boolean" ? (option === "true" ? "Yes" : "No") : option}
        </option>
      ))}
    </FormSelect>
  );
}

/** What a choice means, in the type the field declares. */
function read(field: Field, mode: WriteMode, chosen: string): DraftValue {
  if (chosen === NOTHING) return mode === "create" ? undefined : null;
  return field.type === "boolean" ? chosen === "true" : chosen;
}

/**
 * The input the field's type asks for. Every one of them is the browser's own
 * control for that kind of value — a date picker, a number spinner, a keyboard
 * that knows it is typing an address — because none of that is worth writing
 * again, and an operator already knows all of it.
 */
function TypedInput({
  projectKey,
  field,
  mode,
  value,
  valueLabel,
  control,
  autoFocus,
  onChange,
}: {
  projectKey: string;
  field: Field;
  mode: WriteMode;
  value: DraftValue;
  valueLabel?: string | null;
  control: FormControlProps;
  autoFocus: boolean;
  onChange: (value: DraftValue) => void;
}) {
  const shown = value === null || value === undefined ? "" : String(value);
  const dataFace = DATA_TYPES.has(field.type) ? "font-data" : undefined;

  /**
   * What an empty box means, and it is read off the field rather than guessed.
   *
   * On a record being made it means the field was not answered, so it is left
   * out of the write and the column's own default stands. On one being
   * corrected it means what the type allows: `text`, `longText`, `email` and
   * `url` all have an empty string in their value space, so an empty box is
   * that string and the write path is left to say whether it is allowed. There
   * is no empty number and no empty day, so an empty box there is the field
   * holding nothing — which is what the em-dash beside it says out loud.
   */
  const emptied: DraftValue =
    mode === "create" ? undefined : TEXT_TYPES.has(field.type) ? "" : null;
  const give = (typed: string) => onChange(typed === "" ? emptied : typed);

  /**
   * A relation is chosen rather than typed: the box searches the resource it
   * points at by the name that resource is read by, and what lands in the draft
   * is the key of the record that was chosen (DECISIONS #060). The key itself
   * is still accepted, from the last row of the list.
   */
  if (field.type === "relation") {
    return (
      <RelationPicker
        {...control}
        projectKey={projectKey}
        target={field.target}
        value={shown === "" ? null : shown}
        valueLabel={valueLabel}
        autoFocus={autoFocus}
        placeholder={`Search ${field.label.toLowerCase()}`}
        onChange={(id) => onChange(id ?? emptied)}
      />
    );
  }

  if (field.type === "longText") {
    return (
      <Textarea
        {...control}
        autoFocus={autoFocus}
        value={shown}
        onChange={(event) => give(event.target.value)}
      />
    );
  }

  if (field.type === "dateTime") {
    return (
      <Input
        {...control}
        type="datetime-local"
        // Seconds are shown, because they are the record's rather than the
        // form's: an input that only offers minutes writes `:00` back over
        // whatever second the value was actually stamped with.
        step="1"
        autoFocus={autoFocus}
        className={cn("w-fit", dataFace)}
        value={asLocalInput(shown)}
        // Every moment in this admin is read in UTC (DECISIONS #030), so the
        // digits somebody types are UTC digits and are written as such. A
        // `timestamptz` column keeps exactly them; a `timestamp` column drops
        // the marker and keeps exactly them. Neither is shifted by the offset
        // of whichever machine the form was filled in on.
        onChange={(event) => onChange(event.target.value === "" ? emptied : `${event.target.value}Z`)}
      />
    );
  }

  return (
    <Input
      {...control}
      type={INPUT_TYPES[field.type] ?? "text"}
      {...(field.type === "number" ? { step: "any" } : {})}
      autoFocus={autoFocus}
      className={cn(field.type === "date" || field.type === "number" ? "w-fit" : "w-full", dataFace)}
      value={shown}
      onChange={(event) => give(event.target.value)}
    />
  );
}

/** Which of the browser's own inputs each type is typed into. */
const INPUT_TYPES: Partial<Record<Field["type"], string>> = {
  number: "number",
  date: "date",
  email: "email",
  url: "url",
};

/**
 * A `datetime-local` input holds `YYYY-MM-DDTHH:MM:SS` and no zone. The digits
 * are taken as they are rather than parsed and re-rendered, so a value that
 * arrived without a zone is not quietly moved into one — and the seconds are
 * kept, because dropping them would write a different moment than the one on
 * the record. Anything finer than a second is the one thing a browser's
 * timestamp control cannot hold, and editing a moment gives it up.
 */
function asLocalInput(value: string): string {
  return value.slice(0, 19);
}
