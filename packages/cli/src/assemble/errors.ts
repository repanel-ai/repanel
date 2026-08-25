/**
 * A definition that could not be assembled at all: no layout, a file that is
 * not JSON, a resource under the wrong filename. These are problems with the
 * *arrangement* of the files rather than with the definition, so there is no
 * composed object and no path to point at — but the obligation is the same one
 * validation errors carry (DECISIONS #008): name the file, say what would have
 * been right.
 */
export class AssemblyError extends Error {
  constructor(
    message: string,
    /** A concrete suggested fix. */
    readonly hint: string,
    /** The file the problem is in, relative to the project root. */
    readonly file: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
