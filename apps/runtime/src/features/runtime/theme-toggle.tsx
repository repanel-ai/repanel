import { Button, ThemeIcon } from "@repanel/ui";
import type { Theme } from "./use-theme";

/**
 * Utility chrome, and dressed as such: it sits one step behind the data it
 * frames until it is pointed at (DESIGN.md BUILD REQUIREMENT 3).
 */
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"}
      className="text-utility-foreground hover:text-foreground"
    >
      <ThemeIcon className="size-4" />
    </Button>
  );
}
