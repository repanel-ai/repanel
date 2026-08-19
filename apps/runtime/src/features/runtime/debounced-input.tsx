import { Input, type InputProps } from "@repanel/ui";
import { useEffect, useRef, useState } from "react";

/** Long enough that typing is not a series of questions, short enough to feel answered. */
const SETTLE_MS = 250;

export interface DebouncedInputProps extends Omit<InputProps, "value" | "onChange"> {
  value: string;
  onSettled: (value: string) => void;
}

/**
 * A field that reports what was typed once the typing stops. The value shown is
 * always the one being typed; the value reported is the one the URL and the
 * records query are made of, so a search does not ask the database a question
 * per keystroke.
 */
export function DebouncedInput({ value, onSettled, ...props }: DebouncedInputProps) {
  const [typed, setTyped] = useState(value);

  // The value can also change from outside — `Clear all`, the back button, a
  // link someone pasted — and the box has to follow it.
  useEffect(() => setTyped(value), [value]);

  const settle = useRef(onSettled);
  settle.current = onSettled;

  useEffect(() => {
    if (typed.trim() === value) return;
    // Trimmed on the way out and never on the way in: the space someone is
    // still typing stays under their cursor, and the address and the query are
    // built from the same string.
    const timer = setTimeout(() => settle.current(typed.trim()), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [typed, value]);

  return <Input {...props} value={typed} onChange={(event) => setTyped(event.target.value)} />;
}
