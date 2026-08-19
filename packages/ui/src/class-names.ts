import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The names of the type scale in `tokens.css`. tailwind-merge reads any
 * `text-*` it does not recognize as a text COLOUR, so without this list it
 * would treat `text-micro` and `text-secondary-foreground` as the same
 * question and silently drop the size — leaving a badge at the table's 13.5px
 * instead of the 11.5px the design record fixes. The list is short, and it is
 * the only thing here that has to move when the scale does.
 */
const TEXT_SIZES = ["micro", "small", "body", "title", "nav", "nav-meta"];

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: TEXT_SIZES }] } },
});

/**
 * Joins class lists so a caller's utility always beats the component's own:
 * `<Button className="rounded-none">` must lose its default radius rather than
 * ship both rules and let source order decide.
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
