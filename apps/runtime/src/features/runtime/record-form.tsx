import type { Field, JsonValue, RecordDto, Resource, WriteMode } from "@repanel/contracts";
import { checkRecordValues } from "@repanel/contracts";
import { Button, Dialog, FormFields, Relation } from "@repanel/ui";
import { useState, type ReactNode } from "react";
import { ApiError } from "../../lib/api-client";
import { FormField } from "./form-field";
import {
  changedIn,
  draftFor,
  formFields,
  hasChanges,
  type DraftValue,
  type FormDraft,
} from "./form-draft";
import { problemsIn, type FormProblems } from "./form-problems";
import { useCreateRecord, useUpdateRecord } from "./use-runtime";

export interface RecordFormProps {
  projectKey: string;
  resource: Resource;
  /** The record being corrected. Absent when one is being made. */
  record?: RecordDto;
  /** What to do with the record the write returned. */
  onWritten: (record: RecordDto) => void;
  /** Leaving without writing anything. */
  onLeave: () => void;
}

/**
 * The form: every field the definition opened, in the order it declares them,
 * and the two answers a form has.
 *
 * It carries the opt-in subset and nothing else, so what is on the screen is
 * the whole of what this admin may write to this resource — a field the
 * definition did not open has no control here, and no control anywhere else
 * either (DECISIONS #055).
 *
 * The submission is checked here against exactly the predicate the engine
 * checks it against (`checkRecordValues`), so an operator is told what is wrong
 * beside the input rather than after a round trip. It is not a second opinion:
 * the write path runs the same function again and is the one that decides, and
 * this one only saves a trip.
 */
export function RecordForm({ projectKey, resource, record, onWritten, onLeave }: RecordFormProps) {
  const mode: WriteMode = record ? "update" : "create";
  /**
   * What the form opened with, captured once and never re-read. The record
   * behind it can arrive again — a background refetch, a window regaining focus
   * — and if it did, every control on the screen would move under whoever is
   * typing into it, and "what changed" would be measured against a record they
   * never saw. What is on the screen is what they opened.
   */
  const [seed] = useState<FormDraft>(() => draftFor(resource, mode, record));
  const [draft, setDraft] = useState<FormDraft>(seed);
  const [problems, setProblems] = useState<FormProblems>({ fields: {} });
  const [leaving, setLeaving] = useState(false);

  const create = useCreateRecord(projectKey, resource.key);
  const update = useUpdateRecord(projectKey, resource.key, record?.id ?? "");
  const write = record ? update : create;

  const dirty = hasChanges(draft, seed);
  const fields = formFields(resource, mode);
  /** The fields this screen drew, which is where a refusal can be shown. */
  const drawn = new Set(fields.map((field) => field.key));

  const answer = (field: Field, value: DraftValue) => {
    setDraft((current) => ({ ...current, [field.key]: value }));
    // The sentence under an input is about the value that was there when it was
    // written. Typing makes it out of date, so it goes.
    setProblems((current) => without(current, field.key));
  };

  const submit = () => {
    const values = changedIn(draft, seed);
    const refusals = checkRecordValues(resource, mode, values);
    if (refusals.length > 0) {
      setProblems(problemsIn(refusals, drawn));
      return;
    }

    setProblems({ fields: {} });
    write.mutate(values, {
      onSuccess: onWritten,
      onError: (error) => setProblems(refusedBy(error, drawn)),
    });
  };

  return (
    <>
      {/*
        * A form is a surface that was not on the screen a moment ago, so it
        * arrives the way every other one does (DESIGN.md §12). Nothing about
        * the write moves: pressing save is instant, and the record it lands on
        * is a data surface, which is banned from motion outright.
        *
        * Native validation is off because this form has better sentences than
        * the browser's: the write path's own, under the input they name.
        */}
      <form
        noValidate
        className="flex w-full max-w-form min-w-0 flex-col gap-3 animate-enter"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormFields>
          {fields.map((field) => (
            <FormField
              key={field.key}
              field={field}
              mode={mode}
              value={draft[field.key]}
              error={problems.fields[field.key]}
              note={noteFor(field, record, draft[field.key])}
              onChange={(value) => answer(field, value)}
            />
          ))}
        </FormFields>

        {problems.form !== undefined && (
          <p role="alert" className="text-body text-destructive-text">
            {problems.form}
          </p>
        )}

        <div className="flex items-center gap-2">
          {write.isPending && (
            <span role="status" className="text-small text-muted-foreground">
              Saving…
            </span>
          )}
          <div className="flex-1" />
          <Button
            variant="outline"
            disabled={write.isPending}
            onClick={() => (dirty ? setLeaving(true) : onLeave())}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={write.isPending || (mode === "update" && !dirty)}
          >
            {record ? "Save changes" : `Create ${resource.label.singular.toLowerCase()}`}
          </Button>
        </div>
      </form>

      {/*
        * Leaving a form somebody has typed into is the one thing on this screen
        * worth asking about, and it is asked the way everything else is. What
        * is deliberately not here is a guard on the address bar: a route this
        * screen could refuse to leave is a route the browser's own back button
        * would have to answer to as well, and that is not v1's to build.
        */}
      {leaving && (
        <Dialog
          open
          title="Discard changes"
          confirmLabel="Discard"
          onConfirm={onLeave}
          onCancel={() => setLeaving(false)}
        >
          {`This ${resource.label.singular.toLowerCase()} has changes that have not been saved.`}
        </Dialog>
      )}
    </>
  );
}

/**
 * What there is to say about a value that is not a problem with it. Only a
 * relation has anything: it is written as the key of another record, and a key
 * on its own says nothing about which record that is.
 *
 * So while the field still holds what the record came with, the label that key
 * resolved to is shown under it, wearing the mark every relation in this admin
 * wears (DESIGN.md §5). Change the key and the label goes: it belonged to the
 * record that was there, and leaving it up would be naming the wrong one.
 */
function noteFor(field: Field, record: RecordDto | undefined, value: JsonValue | undefined): ReactNode {
  if (field.type !== "relation") return undefined;

  const current = record?.values[field.key];
  const label =
    current !== null && typeof current === "object" && !Array.isArray(current) && "label" in current
      ? current.label
      : null;

  if (typeof label !== "string" || value !== (current as { id: JsonValue }).id) {
    return "The key of the record to point at.";
  }
  return <>Now: <Relation>{label}</Relation></>;
}

/** Where a refusal from the write path is shown. */
function refusedBy(error: unknown, drawn: ReadonlySet<string>): FormProblems {
  if (error instanceof ApiError && error.details.length > 0) return problemsIn(error.details, drawn);

  return {
    fields: {},
    form:
      error instanceof ApiError ? error.message : "Something went wrong saving this record.",
  };
}

/**
 * The same problems, minus the ones a change to this field made out of date:
 * its own, and the one about the write as a whole — that sentence was about a
 * submission, and the submission is not the same submission any more. Every
 * other field's problem is still true of every other field.
 */
function without(problems: FormProblems, key: string): FormProblems {
  if (!(key in problems.fields) && problems.form === undefined) return problems;
  const { [key]: _gone, ...rest } = problems.fields;
  return { fields: rest };
}
