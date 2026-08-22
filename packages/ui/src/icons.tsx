import type { ReactNode, SVGProps } from "react";

/**
 * Every glyph the component system draws, drawn in-repo (DECISIONS #026): one
 * 24x24 box, a 1.5 stroke, and `currentColor`, so a glyph is coloured and sized
 * by the thing it sits inside and never by itself.
 *
 * These are chrome — search, a chevron, a sort direction, a yes. The marks a
 * resource may be drawn with are a separate, fixed vocabulary the definition
 * names (`resource-icons.tsx`, DECISIONS #031); nothing here maps a resource
 * key to a glyph, and nothing ever may.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "children">;

export function Glyph({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 4.5 4.5" />
    </Glyph>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}

/** Points up for ascending; the caller turns it over for descending. */
export function SortArrowIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </Glyph>
  );
}

/** The other half of a yes: an answer that is present and negative. */
export function CircleIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="7" />
    </Glyph>
  );
}

/** Light and dark, in one glyph: a disc half filled. */
export function ThemeIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
    </Glyph>
  );
}

/** Back to where the record came from. */
export function ArrowLeftIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </Glyph>
  );
}

/** Two sheets, one behind the other: the value is taken, not moved. */
export function CopyIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5.5A1.5 1.5 0 0 0 13.5 4H6a2 2 0 0 0-2 2v7.5A1.5 1.5 0 0 0 5.5 15" />
    </Glyph>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m4.5 12.5 5 5 10-11" />
    </Glyph>
  );
}

/** A dismissal: the thing goes away, nothing else happens. */
export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </Glyph>
  );
}
