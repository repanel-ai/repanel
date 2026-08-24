import { useCallback, useEffect, useRef, useState } from "react";

export type Theme = "light" | "dark";

/** Also read by the pre-paint script in index.html. Both spell it out. */
const STORAGE_KEY = "repanel.theme";

/**
 * How long the crossfade stays armed for, in milliseconds: `--motion-fast`,
 * written out (DESIGN.md §12). It is the one number the motion vocabulary is
 * repeated in, because what arms the crossfade is an attribute on the document
 * rather than a rule in the stylesheet — so if that token moves, this moves.
 */
const SWITCH_MS = 120;

/**
 * Which of the two themes the admin is in. The choice is the operator's and it
 * is remembered (DECISIONS #028).
 *
 * Light is where an admin opens: it is the entry theme on both of RePanel's
 * surfaces, and the OS preference no longer decides the first visit
 * (DECISIONS #035). Dark is not what is left over — it is the surface ladder
 * DESIGN.md §2 specifies, maintained and measured — and this toggle is how an
 * operator asks for it.
 *
 * The swap itself is not instant: `useTheme` marks the document for the length
 * of the fast step, and `tokens.css` crossfades the colours under that mark
 * (DESIGN.md §12). It is the only motion RePanel runs across a data surface,
 * because a theme belongs to the whole screen rather than to anything on it.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  const switched = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    // Mounting is not a switch: the pre-paint script has already put the
    // document in the right theme, and there is nothing to fade between.
    const isSwitch = switched.current;
    switched.current = true;

    // Armed before the class flips, so the browser sees the transition and the
    // new colours in one style recalculation and interpolates between them.
    if (isSwitch) root.dataset.themeSwitching = "";
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
    if (!isSwitch) return;

    const settled = window.setTimeout(() => {
      delete root.dataset.themeSwitching;
    }, SWITCH_MS);
    return () => window.clearTimeout(settled);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}

function storedTheme(): Theme {
  return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}
