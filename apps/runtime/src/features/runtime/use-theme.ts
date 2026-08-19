import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

/** Also read by the pre-paint script in index.html. Both spell it out. */
const STORAGE_KEY = "repanel.theme";

/**
 * Which of the two themes the admin is in. The choice is the operator's and it
 * is remembered: the OS preference decides the first visit and never overrules
 * a decision made since (DECISIONS #028).
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(preferredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}

function preferredTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
