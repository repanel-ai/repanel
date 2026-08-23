import type { ReactNode } from "react";
import { Glyph, type IconProps } from "./icons";

/**
 * The named glyph vocabulary: a closed set of marks, drawn in-repo like
 * everything else (DECISIONS #026), each reachable by name and by nothing else.
 *
 * It is a vocabulary rather than a set of resource icons. The runtime spends it
 * on a definition's `resource.icon` (DECISIONS #031) and the console spends it
 * on its own navigation, and neither of those is what the list *is* — it is
 * thirty marks with names, and a surface that needs one asks for it by name.
 * (This file was `resource-icons.tsx` while the runtime was the only caller,
 * which named it after its first customer rather than after itself.)
 *
 * **Nothing in this repo may map a key to a glyph.** A caller passes a name it
 * was given or chose; a customer's resource may be called `tbl_cust_01`, and
 * guessing a picture from that is the same mistake as guessing a badge's
 * severity from how a value is spelled.
 */
const GLYPHS: Record<string, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.25" />
      <path d="M3.5 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.25 3.25 0 0 1 0 5.6" />
      <path d="M17.6 14.7A6 6 0 0 1 20.5 20" />
    </>
  ),
  building: (
    <>
      <path d="M3.5 20.5h17" />
      <path d="M6 20.5V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v15.5" />
      <path d="M14 20.5V9.5h3.5a1 1 0 0 1 1 1v10" />
      <path d="M9 8h2M9 12h2M9 16h2" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="8" r="3.75" />
      <path d="m10.7 10.7 8.3 8.3" />
      <path d="m15.5 15.5 2-2" />
      <path d="m17.5 17.5 2-2" />
    </>
  ),
  shield: <path d="M12 3.5 5 6v5.6c0 4 2.9 7.4 7 8.9 4.1-1.5 7-4.9 7-8.9V6z" />,
  cart: (
    <>
      <path d="M3 4h2.2l2.4 10.5a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.2L20 7.5H6" />
      <circle cx="9.5" cy="19.3" r="1.4" />
      <circle cx="17" cy="19.3" r="1.4" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M9 8.5h6M9 12.5h6" />
    </>
  ),
  "credit-card": (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <path d="M6.5 14.5h3" />
    </>
  ),
  package: (
    <>
      <path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5z" />
      <path d="M3.5 7.5 12 12l8.5-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  truck: (
    <>
      <path d="M3 6.5h10.5v10H3z" />
      <path d="M13.5 10h4l3 3.2v3.3h-7z" />
      <circle cx="7" cy="18.5" r="1.6" />
      <circle cx="17" cy="18.5" r="1.6" />
    </>
  ),
  tag: (
    <>
      <path d="M11.6 3.5H20v8.4l-8.8 8.8a1.5 1.5 0 0 1-2.1 0l-6.3-6.3a1.5 1.5 0 0 1 0-2.1z" />
      <circle cx="16.4" cy="7.6" r="1.2" />
    </>
  ),
  wallet: (
    <>
      <path d="M18 7.5v-1a1.5 1.5 0 0 0-1.5-1.5H5.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H18.5a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z" />
      <circle cx="16.5" cy="13" r="1.2" />
    </>
  ),
  file: (
    <>
      <path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z" />
      <path d="M14 3.5V8h4.5" />
    </>
  ),
  folder: (
    <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h3.9l2 2.5h8.1A1.5 1.5 0 0 1 20.5 9v9.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17.5 4.5-4.5 4 4 3-3 5 5" />
    </>
  ),
  book: (
    <>
      <path d="M5 4.5h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2z" />
      <path d="M5 17.5a2 2 0 0 1 2-2h11" />
    </>
  ),
  message: (
    <path d="M20 15.5a1.5 1.5 0 0 1-1.5 1.5H9.5L5 20.5V6a1.5 1.5 0 0 1 1.5-1.5h12A1.5 1.5 0 0 1 20 6z" />
  ),
  mail: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="m3.5 7.5 8.5 6 8.5-6" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.5" ry="2.8" />
      <path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" />
      <path d="M4.5 12c0 1.6 3.4 2.8 7.5 2.8s7.5-1.2 7.5-2.8" />
    </>
  ),
  webhook: (
    <>
      <circle cx="7.5" cy="7.5" r="2.75" />
      <circle cx="6.5" cy="17.5" r="2.75" />
      <circle cx="17" cy="15" r="2.75" />
      <path d="m8.8 9.9-1.4 4.9" />
      <path d="M9.2 17.9h5" />
      <path d="m15.6 12.6-5.4-4.1" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="m7.5 9.5 3 2.5-3 2.5" />
      <path d="M13 15h4" />
    </>
  ),
  activity: <path d="M3 12h4l2.5-7 4.5 14 2.5-7h4.5" />,
  bell: (
    <>
      <path d="M18 9.5a6 6 0 0 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5" />
      <path d="M13.8 19.5a2 2 0 0 1-3.6 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
      <path d="M3.5 10.5h17" />
      <path d="M8 3.5v4M16 3.5v4" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3" />
      <path d="m18.7 5.3-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" />
    </>
  ),
  chart: (
    <>
      <path d="M4 3.5v17h16.5" />
      <path d="M8 17v-4.5M12.5 17V7.5M17 17v-8" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4 12h16" />
      <ellipse cx="12" cy="12" rx="3.6" ry="8" />
    </>
  ),
  link: (
    <>
      <path d="M10.2 13.8a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 1 0-5-5l-1.4 1.4" />
      <path d="M13.8 10.2a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 1 0 5 5l1.4-1.4" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M9.5 9.5v10" />
    </>
  ),
};

/** Every mark the vocabulary can draw. The definition's list must match it. */
export const RESOURCE_ICON_NAMES = Object.keys(GLYPHS);

export interface ResourceIconProps extends IconProps {
  /** The name the definition gave. Anything unknown falls back to the generic. */
  name: string;
}

/**
 * One mark, by name. It draws the name it is given and the generic `table` for
 * anything it does not recognise — validation has already refused a name
 * outside the vocabulary, so the fallback is the defense behind that door
 * rather than a decision this makes.
 */
export function ResourceIcon({ name, ...props }: ResourceIconProps) {
  return <Glyph {...props}>{GLYPHS[name] ?? GLYPHS.table}</Glyph>;
}
