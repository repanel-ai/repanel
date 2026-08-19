import { cn } from "./class-names";

export interface FormErrorProps {
  /** What went wrong, in the words the caller wants shown. */
  message?: string | null;
  className?: string;
}

/**
 * The one place a form's failure is rendered. Nothing at all when there is
 * nothing wrong: an empty live region announces itself on every render.
 */
export function FormError({ message, className }: FormErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-sm text-danger", className)}>
      {message}
    </p>
  );
}
