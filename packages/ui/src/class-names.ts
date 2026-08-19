import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Joins class lists so a caller's utility always beats the component's own:
 * `<Button className="rounded-none">` must lose its default radius rather than
 * ship both rules and let source order decide.
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
