import { useCallback, useEffect, useState } from "react";

/**
 * Which face machine-shaped values — ids, dates, references, JSON — are set in.
 *
 * TEMPORARY. DESIGN.md BUILD REQUIREMENT 5 asks for both renderings at
 * checkpoint C so the choice can be made from screens rather than from
 * argument. The winner is hardcoded in `tokens.css` and this file is deleted
 * with the decision; it is not a setting, and it is never offered to an
 * operator.
 */
export type DataFace = "sans" | "mono";

const STORAGE_KEY = "repanel.dataFace";

export function useDataFace(): { face: DataFace; toggle: () => void } {
  const [face, setFace] = useState<DataFace>(storedFace);

  useEffect(() => {
    // `.data-mono` re-points `--font-data` and changes nothing else, which is
    // what makes the two variants comparable rather than two designs.
    document.documentElement.classList.toggle("data-mono", face === "mono");
    window.localStorage.setItem(STORAGE_KEY, face);
  }, [face]);

  const toggle = useCallback(() => {
    setFace((current) => (current === "mono" ? "sans" : "mono"));
  }, []);

  return { face, toggle };
}

function storedFace(): DataFace {
  return window.localStorage.getItem(STORAGE_KEY) === "mono" ? "mono" : "sans";
}
