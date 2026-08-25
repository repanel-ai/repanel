/**
 * How a command talks to whoever started it while it runs.
 *
 * A command returns what it printed (`CommandResult`), so this is only for the
 * conversation that cannot wait for the end: a question that decides what
 * happens next, a line of progress, a browser to open. The transport is
 * `bin.ts`'s to decide, once, which is what makes every command's conversation
 * something a test can read back.
 *
 * Everything but `write` is absent when there is nobody at a terminal, and
 * that absence is a fact rather than a gap: a command that cannot ask refuses
 * rather than assumes.
 */
export interface Terminal {
  write(line: string): void;
  /**
   * Whether what is written lands somewhere that renders ANSI. Absent is no,
   * which is the safe answer: a pipe, a log file and a CI run all read a colour
   * code as the characters it is made of.
   */
  readonly colors?: boolean;
  /** Asks a yes/no question, defaulting to yes on an empty line. */
  confirm?: (question: string) => Promise<boolean>;
  /** Asks for a line of text; an empty line means "take the default". */
  ask?: (question: string) => Promise<string>;
  /** Opens an address in the operator's browser, where there is one. */
  browse?: (url: string) => void;
}


/**
 * The whole of RePanel's terminal voice, in five marks and two weights.
 *
 * There is no palette here and there will not be one. A terminal is somebody
 * else's theme — their background, their sixteen colours, their contrast — and
 * the only distinctions worth drawing on top of it are which text is a label,
 * which line is the point of the screen, and whether a thing went well, wants
 * attention, or did not go at all.
 *
 * Every method is the identity function when colour is off, so a plain terminal
 * gets the same layout with none of the codes in it: the gutters, the marks and
 * the blank lines are the design, and the colour is the emphasis on top.
 */
export interface Style {
  /** A label in a gutter: present, and quieter than the value beside it. */
  label(text: string): string;
  /** The one line on the screen that is the point of it. */
  headline(text: string): string;
  /** It went well. */
  readonly ok: string;
  /** It wants somebody to do something. */
  readonly warn: string;
  /** It did not go. */
  readonly bad: string;
}

const RESET = "\u001B[0m";

/** Select Graphic Rendition, written out — there are five of them and no more. */
const DIM = "\u001B[2m";
const STRONG = "\u001B[1;36m";
const GREEN = "\u001B[32m";
const YELLOW = "\u001B[33m";
const RED = "\u001B[31m";

const MARKS = { ok: "\u2713", warn: "\u26A0", bad: "\u2717" } as const;

const PLAIN: Style = {
  label: (text) => text,
  headline: (text) => text,
  ...MARKS,
};

const COLOURED: Style = {
  label: (text) => `${DIM}${text}${RESET}`,
  headline: (text) => `${STRONG}${text}${RESET}`,
  ok: `${GREEN}${MARKS.ok}${RESET}`,
  warn: `${YELLOW}${MARKS.warn}${RESET}`,
  bad: `${RED}${MARKS.bad}${RESET}`,
};

/** How a command writes, given whether the thing reading it can render colour. */
export function styling(colors: boolean | undefined): Style {
  return colors === true ? COLOURED : PLAIN;
}

/**
 * Whether ANSI may be spent at all. Both answers belong to somebody else: a
 * terminal that can render it, and the NO_COLOR convention — set and not empty,
 * whatever it is set to — asking that it not be.
 *
 * It is a function rather than a read of `process` so that both answers can be
 * given to it, which is the only way either of them is ever checked.
 */
export function colorsAllowed(isTerminal: boolean, env: NodeJS.ProcessEnv): boolean {
  const asked = env.NO_COLOR;
  if (asked !== undefined && asked !== "") return false;
  return isTerminal;
}
