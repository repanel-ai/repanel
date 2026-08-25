import { OPTIONS_LIMIT, type RecordOptionDto } from "@repanel/contracts";
import { Combobox, type ComboboxOption } from "@repanel/ui";
import { useEffect, useState } from "react";
import { useRecordOptions } from "./use-runtime";

/** Long enough that typing is not a series of questions, short enough to feel
 *  answered — the same step the search box settles on. */
const SETTLE_MS = 250;

export interface RelationPickerProps {
  projectKey: string;
  /** The resource on the other side: the one whose records are offered. */
  target: string;
  /** The key the field or the filter is currently set to. */
  value: string | null;
  /** What that key is called, where whoever opened the screen already knew. */
  valueLabel?: string | null;
  /** The key that was chosen, or nothing where nothing is a legal answer. */
  onChange: (id: string | null) => void;
  /** Whether nothing is a legal answer — a filter's `Any`. */
  clearable?: boolean;
  placeholder?: string;
  /** Whether the cursor belongs here as soon as the control is drawn. */
  autoFocus?: boolean;
  /** Worn inside the box, where the control has nowhere else to say it. */
  label?: string;
  id?: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
}

/**
 * Choosing the record a relation points at.
 *
 * A relation is stored as a key and read as a name, and this is the one control
 * where an operator meets both: they type a name, the target resource answers
 * with the records that match it, and what gets written is the key of the one
 * they chose. The key they already have still works — the last row offers it as
 * itself — because a search over labels cannot find a record nobody labelled.
 *
 * It is the same control on a form and above a table. The only thing that
 * differs is whether nothing is an answer: a filter set to nothing is `Any`,
 * and a field holding nothing is the record page's own em-dash, which the form
 * row draws beside the box rather than in it.
 */
export function RelationPicker({
  projectKey,
  target,
  value,
  valueLabel,
  onChange,
  clearable = false,
  placeholder,
  autoFocus,
  label,
  id,
  required,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
}: RelationPickerProps) {
  /**
   * The record the key names, as far as this control knows it. A key is all the
   * value ever is; the name comes from the record the screen was drawn from, or
   * from the row that was chosen a moment ago — and once it is known it is kept,
   * because nothing else on this screen can tell the operator which record they
   * are looking at.
   */
  const [chosen, setChosen] = useState<ComboboxOption | null>(() => optionFor(value, valueLabel));
  const [query, setQuery] = useState(() => textOf(chosen));
  /** Nothing is asked until somebody opens this: a filter bar is several of
   *  these and a form is several more. */
  const [live, setLive] = useState(false);

  /**
   * The box follows the value when the value is changed from somewhere else —
   * `Clear all` speaks for every filter at once, and a box still showing what it
   * used to hold would be the one thing on the screen disagreeing with the
   * address bar. A name already known for that same key survives it.
   */
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    const next = chosen !== null && chosen.id === value ? chosen : optionFor(value, valueLabel);
    setSeen(value);
    setChosen(next);
    setQuery(textOf(next));
  }

  /**
   * What the list is narrowed by. Opening a picker is asking what else there is,
   * so the name already in the box is not a search: it stays on screen, selected
   * so that one keystroke replaces it, and the list under it is everything until
   * somebody types.
   */
  const term = useSettled(query === textOf(chosen) ? "" : query);
  const options = useRecordOptions(projectKey, target, term, live);
  const found = options.data ?? [];

  return (
    <Combobox
      query={query}
      onQueryChange={setQuery}
      options={offered(found, query, chosen)}
      value={chosen}
      onSelect={(option) => {
        setChosen(option);
        setQuery(textOf(option));
        onChange(option.id);
      }}
      onOpenChange={(open) => open && setLive(true)}
      {...(clearable
        ? {
            onClear: () => {
              setChosen(null);
              setQuery("");
              onChange(null);
            },
          }
        : {})}
      loading={options.isFetching}
      note={found.length === OPTIONS_LIMIT ? MORE : undefined}
      placeholder={placeholder}
      autoFocus={autoFocus}
      label={label}
      id={id}
      required={required}
      aria-invalid={invalid}
      aria-describedby={describedBy}
    />
  );
}

/** Said when the answer was as long as the engine will make one (#014). */
const MORE = `The first ${OPTIONS_LIMIT} matches. Keep typing to narrow them.`;

/**
 * The rows the list offers: what the search found, and — when it found nothing —
 * what was typed, offered as a key.
 *
 * The key row appears on exactly that condition. A search that is still matching
 * records is a search, and offering to write the letters of it as a key beside
 * the records they found would be offering an answer nobody meant. When the
 * search comes back with nothing there is no such confusion: either the text is
 * a key, or the record it names has no name to be found by — and both of those
 * are what the row is for.
 *
 * A key reaches the control as text whatever the column holds, which is the
 * same thing that happens to it in an address bar: a control holds characters,
 * and the column on the other side decides what they are (DECISIONS #024).
 */
function offered(
  found: readonly RecordOptionDto[],
  query: string,
  chosen: ComboboxOption | null,
): ComboboxOption[] {
  const rows = found.map((option) => ({ id: String(option.id), label: option.label }));
  const typed = query.trim();
  if (rows.length > 0 || typed === "" || typed === textOf(chosen)) return rows;

  return [{ id: typed, label: null, raw: true }];
}

/** The key and what it is called, as one thing to show and choose. */
function optionFor(value: string | null, label: string | null | undefined): ComboboxOption | null {
  if (value === null || value === "") return null;
  return { id: value, label: label ?? null };
}

function textOf(option: ComboboxOption | null): string {
  if (option === null) return "";
  return option.label ?? option.id;
}

/**
 * What was typed, once the typing stops. The box shows every keystroke; the
 * question behind it is asked of the value they settled on, so a search is not
 * one request per character.
 */
function useSettled(value: string): string {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    if (value.trim() === settled) return;
    const timer = setTimeout(() => setSettled(value.trim()), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [value, settled]);

  return settled;
}
