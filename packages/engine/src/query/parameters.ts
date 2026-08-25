/**
 * The bound values of one query, numbered as they are added. Everything a
 * request contributes goes through here and comes back as `$1`, `$2`, … — the
 * only route a value has into a query. There is no method that returns SQL, so
 * there is no way to write a value into the statement instead.
 */
export class Parameters {
  private readonly bound: unknown[] = [];

  /** Files a value and answers with the placeholder that stands for it. */
  bind(value: unknown): string {
    this.bound.push(value);
    return `$${this.bound.length}`;
  }

  /** What to send alongside the statement, in the order the placeholders name. */
  values(): unknown[] {
    return [...this.bound];
  }
}
