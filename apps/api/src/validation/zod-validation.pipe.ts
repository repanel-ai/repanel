import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from "@nestjs/common";
import { schemaOf } from "./zod-dto";

/**
 * Validates every handler argument whose declared type carries a zod schema and
 * passes on the parsed value; arguments without one are left untouched.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = schemaOf(metadata.metatype);
    if (!schema) return value;

    const result = schema.safeParse(value);
    if (result.success) return result.data;

    // Every offending field at once: one round trip per fix is one too many.
    throw new BadRequestException(
      result.error.issues.map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; "),
    );
  }
}
