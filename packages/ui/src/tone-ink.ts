import type { BadgeTone } from "./badge";

/**
 * The badge language's four tones, as ink rather than as fill.
 *
 * The vocabulary is the same one `Badge` spends (DECISIONS #029) and the words
 * are the definition's own. What changes is the treatment: a fill is for a
 * value standing on its own as a state, and ink is for a value sitting in a row
 * of data — a control the height of a form row, or a line of a log, wearing a
 * badge's tint would be a coloured block on a data panel, which is the thing a
 * notice stopped being and for the same reason (DECISIONS #052, #057).
 *
 * It is here rather than inside either component because two of them spend it,
 * and a second copy of a colour map is a second thing to keep in step.
 */
export const TONE_INK: Record<BadgeTone, string> = {
  neutral: "text-foreground",
  positive: "text-positive-text",
  attention: "text-attention-text",
  critical: "text-destructive-text",
};
