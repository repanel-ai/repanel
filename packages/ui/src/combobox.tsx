import * as Popover from "@radix-ui/react-popover";
import { useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./class-names";
import { ControlShell } from "./control-shell";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { Input } from "./input";

/** What the list offers: a record to point at, by key and by name. */
export interface ComboboxOption {
  /** The key that would be written. */
  id: string;
  /** What the record is called, or null where it has no name of its own. */
  label: string | null;
  /**
   * Offered as a key that was typed rather than as a record that was found. It
   * is chosen exactly like any other row; it only says so.
   */
  raw?: boolean;
}

export interface ComboboxProps {
  /** What is in the box. The owner holds it, so the box is never out of step. */
  query: string;
  onQueryChange: (query: string) => void;
  /** The records to choose from, as they arrived. */
  options: readonly ComboboxOption[];
  /** The one that is chosen, so the list can say which it is. */
  value: ComboboxOption | null;
  onSelect: (option: ComboboxOption) => void;
  /**
   * The list has been opened, or closed. It is reported rather than controlled:
   * whoever fetches the rows has no business deciding when a list is up, and no
   * way of knowing until it is.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Taking the value away, where it may be taken away. It is the filter's own
   * word — a form field that may hold nothing says so with the mark the record
   * page uses, beside the box rather than inside it.
   */
  onClear?: () => void;
  /** A question is in flight, so the list on screen is not the answer yet. */
  loading?: boolean;
  /** Something true about the list that is not one of its rows. */
  note?: ReactNode;
  placeholder?: string;
  /** Whether the cursor belongs here as soon as the control is drawn. */
  autoFocus?: boolean;
  /**
   * What the control answers, worn inside the box. A filter has nowhere else to
   * say it; a form field is named by the row it sits in and passes `id`
   * instead. It is the same distinction `Select` and `FormSelect` are, said as
   * one prop because unlike a `<select>` this control's behaviour is ours and
   * must not be written twice.
   */
  label?: string;
  id?: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  className?: string;
}

/** One row of the list: what it says, and what choosing it does. */
interface Row {
  key: string;
  name: string;
  body: ReactNode;
  selected: boolean;
  choose: () => void;
}

/**
 * A box that searches, and a list of what it found.
 *
 * It is the one control RePanel owns that the browser has no element for: a
 * `<select>` cannot be typed into, a `<datalist>` cannot show a name and write
 * a key, and neither can be dressed. So the behaviour is written here, once —
 * the combobox pattern's own keyboard, its `aria-activedescendant`, and a list
 * that is a real listbox — and the floating panel underneath is Radix's, which
 * is what puts it above a panel that clips its own overflow, keeps it anchored
 * while the page scrolls, and closes it on a press outside.
 *
 * What it does not do is fetch: it is handed rows and hands back the one that
 * was chosen. Where those come from is the runtime's business (DESIGN.md §12
 * gives the panel the enter every arriving surface gets, and nothing else here
 * moves).
 */
export function Combobox({
  query,
  onQueryChange,
  options,
  value,
  onSelect,
  onOpenChange,
  onClear,
  loading = false,
  note,
  placeholder,
  autoFocus = false,
  label,
  id,
  required = false,
  "aria-invalid": invalid,
  "aria-describedby": describedBy,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const anchor = useRef<HTMLDivElement>(null);

  const rows: Row[] = [
    ...(onClear
      ? [
          {
            key: "clear",
            name: "Any",
            body: <span className="text-muted-foreground">Any</span>,
            selected: value === null,
            choose: onClear,
          },
        ]
      : []),
    ...options.map((option) => ({
      key: `record:${option.id}`,
      name: option.raw ? `Use key ${option.id}` : textOf(option),
      body: option.raw ? <UsedAsKey id={option.id} /> : <Named option={option} />,
      selected: value?.id === option.id,
      choose: () => onSelect(option),
    })),
  ];

  const show = (at: number) => {
    if (!open) onOpenChange?.(true);
    setOpen(true);
    setActive(at);
  };

  const close = () => {
    if (open) onOpenChange?.(false);
    setOpen(false);
    setActive(0);
  };

  /** Leaving without choosing puts back what is chosen, whatever was typed. */
  const abandon = () => {
    close();
    if (query !== textOf(value)) onQueryChange(textOf(value));
  };

  const keyed = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      show(open ? Math.min(active + 1, rows.length - 1) : 0);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      show(open ? Math.max(active - 1, 0) : 0);
      return;
    }
    if (!open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      abandon();
      return;
    }
    if (event.key === "Enter") {
      const row = rows[active];
      if (!row) return;
      // The form around this box is not being submitted; a record is being
      // chosen. Once the list is open, enter belongs to the list.
      event.preventDefault();
      row.choose();
      close();
    }
  };

  const box = (
    <Input
      role="combobox"
      id={id}
      value={query}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoComplete="off"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      aria-autocomplete="list"
      aria-activedescendant={open ? rows[active] && optionId(listId, active) : undefined}
      // The box holds a name and the field holds a key, so the browser's own
      // required check would be checking the wrong string. The fact is still
      // said, where a screen reader reads it.
      aria-required={required || undefined}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      className={cn(
        label === undefined
          ? "w-full"
          : [
              "h-auto w-auto flex-1 border-0 bg-transparent px-0 focus-visible:ring-0",
              // The voice every filter on the bar speaks: quiet until it is
              // answered, and forward once it is.
              value !== null && "font-medium",
            ],
        className,
      )}
      onChange={(event) => {
        onQueryChange(event.target.value);
        show(0);
      }}
      // One keystroke starts a new search rather than editing the name of the
      // record that is already chosen.
      onFocus={(event) => event.target.select()}
      onBlur={(event) => {
        if (!anchor.current?.contains(event.relatedTarget)) abandon();
      }}
      onKeyDown={keyed}
    />
  );

  return (
    <Popover.Root open={open} onOpenChange={(next) => (next ? show(0) : abandon())}>
      <Popover.Anchor asChild>
        <div ref={anchor} className="relative flex w-full min-w-0 items-center">
          {label === undefined ? (
            box
          ) : (
            <ControlShell label={label} className={cn("w-full pr-7", className)}>
              {box}
            </ControlShell>
          )}
          <ChevronDownIcon className="pointer-events-none absolute right-3 size-3 opacity-55" />
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        {/*
          * The panel arrives the way every other surface that was not on the
          * screen a moment ago does, and does not leave (DESIGN.md §12).
          * Focus stays in the box while it is up: this is a list being read
          * from a box, not a dialog being moved into.
          */}
        <Popover.Content
          role="presentation"
          align="start"
          sideOffset={4}
          style={{ width: "var(--radix-popover-trigger-width)" }}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          // A press on a row must not take the cursor out of the box first.
          onPointerDown={(event) => event.preventDefault()}
          className="z-20 min-w-52 overflow-hidden rounded-lg border border-border bg-card py-1 text-body animate-enter"
        >
          <ul id={listId} role="listbox" className="max-h-64 overflow-y-auto">
            {rows.map((row, at) => (
              <li
                key={row.key}
                id={optionId(listId, at)}
                role="option"
                aria-selected={row.selected}
                onMouseMove={() => setActive(at)}
                onClick={() => {
                  row.choose();
                  close();
                }}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-2.5 py-1 leading-5",
                  at === active && "bg-muted text-accent-foreground",
                )}
              >
                <span className="min-w-0 flex-1">{row.body}</span>
                {/* Two different facts, and the list shows both at once: the
                    row an operator is on is the one under the highlight, and
                    the record the field holds is the one wearing this. */}
                {row.selected && (
                  <CheckIcon data-slot="chosen" className="size-3.5 shrink-0 opacity-70" />
                )}
              </li>
            ))}
          </ul>

          {rows.length === 0 && (
            <p className="px-2.5 py-1 leading-5 text-muted-foreground">
              {loading ? "Searching…" : "No matches"}
            </p>
          )}
          {note !== undefined && (
            <p className="border-t border-border px-2.5 pt-1.5 pb-0.5 mt-1 text-small text-muted-foreground">
              {note}
            </p>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** A record, by the name it is chosen by — or by its key, having none. */
function Named({ option }: { option: ComboboxOption }) {
  if (option.label === null) return <span className="font-data">{option.id}</span>;
  return <span className="truncate">{option.label}</span>;
}

/**
 * The key somebody typed, offered as itself. A relation is written as a key, so
 * an operator who has one must be able to use it where no search would find the
 * record — a row nobody labelled, or a table too large to have been indexed for
 * this.
 */
function UsedAsKey({ id }: { id: string }) {
  return (
    <span className="flex min-w-0 items-baseline gap-1.5 text-muted-foreground">
      {/* The space is read rather than seen: a flex row lays the gap out, and a
          whitespace-only child of one is not laid out at all — but it is still
          what stands between the two words when the row is read aloud. */}
      Use key{" "}
      <span className="truncate font-data text-foreground">{id}</span>
    </span>
  );
}

/** What the box shows for a record: its name, or the key it has instead. */
function textOf(option: ComboboxOption | null): string {
  if (option === null) return "";
  return option.label ?? option.id;
}

function optionId(listId: string, at: number): string {
  return `${listId}-${at}`;
}
