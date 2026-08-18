/** A project as the API returns it. Who owns it is not the wire's business. */
export interface ProjectDto {
  id: string;
  name: string;
  /** Stable routing identity, e.g. `skyscout-a3k9x2`. Fixed at creation. */
  key: string;
  /** ISO 8601: a DTO carries no `Date`, so browser and Node read it alike. */
  createdAt: string;
}
