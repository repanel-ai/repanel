import { z } from "zod";

/**
 * The marks a resource may be drawn with. A fixed vocabulary rather than free
 * text: the runtime draws every glyph itself (DECISIONS #026), so a name it
 * cannot draw is a name it cannot honour — and an admin whose sidebar silently
 * falls back is worse than one that never had icons.
 *
 * It is deliberately generous and deliberately closed. Adding a name is
 * additive and cheap; letting a definition ask for an arbitrary one would make
 * the icon set a dependency of every customer's imagination.
 */
export const ICON_NAMES = [
  "user",
  "users",
  "building",
  "key",
  "shield",
  "cart",
  "receipt",
  "credit-card",
  "package",
  "truck",
  "tag",
  "wallet",
  "file",
  "folder",
  "image",
  "book",
  "message",
  "mail",
  "database",
  "webhook",
  "terminal",
  "activity",
  "bell",
  "clock",
  "calendar",
  "settings",
  "chart",
  "globe",
  "link",
  "table",
] as const;

/** What a resource with nothing to say about itself is drawn with. */
export const DEFAULT_ICON = "table";

export const iconNameSchema = z.enum(ICON_NAMES);

export type IconName = z.infer<typeof iconNameSchema>;
