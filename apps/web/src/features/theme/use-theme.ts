import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

/** Also read by the pre-paint script in index.html. Both spell it out. */
const STORAGE_KEY = "repanel.theme";

/**
 * Which of the two themes the console is in — the runtime's hook, on the
 * console's own root class.
 *
 * It is copied rather than shared: `packages/ui` is presentational and holds
 * no logic, and a hook that writes to a browser store and moves a class on the
 * document is not a component. Thirty lines in each app is the cheaper of the
 * two mistakes available.
 *
 * Light is where the console opens, as the admin does (DECISIONS #035); dark
 * is a designed theme reached by this toggle, not a fallback.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}

function storedTheme(): Theme {
  return window.localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}
