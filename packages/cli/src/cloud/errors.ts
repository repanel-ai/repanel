/**
 * Something between this machine and RePanel that the operator has to settle
 * before the command can go on: not signed in, no such project, nothing
 * answering at the address.
 *
 * It carries a fix, like every other problem this CLI reports (DECISIONS
 * #008). Nothing that ever passes through here carries a secret: a refusal is
 * told in the API's own words, and the API writes them for the person reading
 * them.
 */
export class CloudError extends Error {
  constructor(
    message: string,
    /** A concrete suggested fix. */
    readonly hint: string,
    /** The status the API answered with, when it was the API that answered. */
    readonly status?: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
