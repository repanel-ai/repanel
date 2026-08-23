import { Button, ThemeIcon } from "@repanel/ui";
import { useTheme } from "./use-theme";

/**
 * Utility chrome, and dressed as such: it sits one step behind what it frames
 * until it is pointed at (DESIGN.md BUILD REQUIREMENT 3). It carries its own
 * state rather than taking it as a prop, because the console has one of these
 * and nothing else on the screen needs to know which theme it is in.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"}
      className="text-utility-foreground hover:text-foreground"
    >
      <ThemeIcon className="size-4" />
    </Button>
  );
}
