import { ZodType } from "zod";
import type { z } from "zod";

/** A request type whose schema survives compilation: instances are its output. */
export interface ZodDto<Schema extends ZodType> {
  new (): z.output<Schema>;
  readonly schema: Schema;
}

/**
 * Binds a request schema to a class, because a parameter's declared type is the
 * only thing a global pipe can see at runtime:
 * `class LoginDto extends zodDto(loginRequestSchema) {}`.
 */
export function zodDto<Schema extends ZodType>(schema: Schema): ZodDto<Schema> {
  return class {
    static readonly schema = schema;
  } as unknown as ZodDto<Schema>;
}

/** The schema a handler parameter carries, if it was declared with `zodDto`. */
export function schemaOf(metatype: unknown): ZodType | undefined {
  if (typeof metatype !== "function") return undefined;
  const { schema } = metatype as { schema?: unknown };
  return schema instanceof ZodType ? schema : undefined;
}
