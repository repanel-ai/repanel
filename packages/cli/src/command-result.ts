/**
 * What a command prints and what it exits with. Commands return their output
 * rather than writing it: the stream is a transport decision, made once in
 * `bin.ts`, and a command whose output is a value is a command that can be
 * tested by reading it.
 */
export interface CommandResult {
  readonly exitCode: number;
  readonly lines: readonly string[];
}
