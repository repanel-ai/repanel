import { SearchIcon } from "@repanel/ui";
import { useEffect, useRef } from "react";
import { DebouncedInput } from "./debounced-input";

export interface SearchBoxProps {
  value: string;
  onSearch: (term: string) => void;
  /** What the resource is called, so the box says what it searches. */
  label: string;
  /** The fields the definition says the box covers. */
  fields: string[];
}

/**
 * The free-text box. `/` puts the cursor in it from anywhere on the page — the
 * one shortcut the runtime claims, and the hint sits in the box that owns it.
 */
export function SearchBox({ value, onSearch, label, fields }: SearchBoxProps) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      input.current?.focus();
    };

    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  return (
    <div className="relative w-[268px] max-w-full">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <DebouncedInput
        ref={input}
        type="search"
        value={value}
        onSettled={onSearch}
        aria-label={`Search ${label}`}
        placeholder={`Search ${fields.join(", ")}`}
        className="px-8"
      />
      <span
        aria-hidden="true"
        className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm border border-border bg-muted px-1 text-micro leading-4 text-muted-foreground"
      >
        /
      </span>
    </div>
  );
}

/** A `/` typed into a field is a `/`, not a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}
