import { formatList, type ValidationError } from "./errors.js";
import { isWritableType, WRITABLE_FIELD_TYPES } from "./fields.js";
import { sensitiveFieldError, type FieldEntry } from "./reference-errors.js";
import { editableFields, offersWrites, type Resource } from "./schema.js";

/**
 * What a resource may be written through, and whether it said so.
 *
 * Writability is declared twice — once by the resource, once by the field — and
 * neither half is allowed to stand alone. A field marked `editable` on a
 * resource that offers no write is not a harmless leftover: it is an author who
 * believes they opened a form, and finding out from a blank screen is the worst
 * way to learn otherwise. So both halves report, and both point at the other.
 */
export function checkWrites(
  resource: Resource,
  at: string,
  fields: ReadonlyMap<string, FieldEntry>,
): ValidationError[] {
  const errors: ValidationError[] = [...checkReadOnly(resource, at)];
  const offered = offersWrites(resource);
  const editable = editableFields(resource);

  if (offered && editable.length === 0) {
    errors.push({
      path: `${at}.writes`,
      message: `Resource \`${resource.key}\` offers writes but has no editable field.`,
      expected: "at least one field marked `editable` when `writes` offers anything",
      hint: `Mark the fields an operator may type into with \`"editable": true\`, or remove \`${at}.writes\`; a form with no fields is not a form.`,
    });
  }

  for (const entry of fields.values()) {
    const { field, index } = entry;
    const fieldAt = `${at}.fields[${index}]`;

    if (field.required && !field.editable) {
      errors.push({
        path: `${fieldAt}.required`,
        message: `Field \`${field.key}\` is marked required but is not editable.`,
        expected: "`required` only on a field marked `editable`",
        hint: `\`required\` says what a form must carry, and nothing writes \`${field.key}\` — add \`"editable": true\` to \`${fieldAt}\`, or remove \`${fieldAt}.required\`.`,
      });
    }

    if (!field.editable) continue;

    if (!offered) {
      errors.push({
        path: `${fieldAt}.editable`,
        message: `Field \`${field.key}\` is marked editable but resource \`${resource.key}\` offers no writes.`,
        expected: "`writes` on the resource, naming which writes it offers",
        hint: `Writability is said twice on purpose. Add \`"writes": { "create": true, "update": true }\` to \`${at}\` to offer the form, or remove \`${fieldAt}.editable\` to keep \`${resource.key}\` read-only.`,
      });
    }

    if (field.sensitive) {
      errors.push(
        sensitiveFieldError({
          path: `${fieldAt}.editable`,
          key: field.key,
          problem: "cannot be editable",
          fix: `A secret is never typed into an admin: the value would travel in a request body, and the form would have to render whatever is there now to let anyone change it. Move this write into an endpoint in your application and call it with an \`httpCall\` action (see DECISIONS #010).`,
        }),
      );
      continue;
    }

    if (field.key === resource.primaryKey) {
      errors.push({
        path: `${fieldAt}.editable`,
        message: `Field \`${field.key}\` is the primary key of \`${resource.key}\` and cannot be editable.`,
        expected: "a field that is not the resource's `primaryKey`",
        hint: `A primary key addresses the record rather than describing it — it is in the URL of the very form that would edit it. Remove \`${fieldAt}.editable\`; let the database issue the key, and change what the record says about itself instead.`,
      });
      continue;
    }

    if (!isWritableType(field.type)) {
      errors.push({
        path: `${fieldAt}.editable`,
        message: `Field \`${field.key}\` has type \`${field.type}\` and cannot be editable.`,
        expected: `a field of one of: ${formatList(WRITABLE_FIELD_TYPES)}`,
        hint: `A \`${field.type}\` value has no input that fits it, and its shape belongs to your application rather than to the admin — edit it through an endpoint called with an \`httpCall\` action (see DECISIONS #010), or remove \`${fieldAt}.editable\`.`,
      });
    }
  }

  return errors;
}

/**
 * `readOnly` is what every resource said before writes existed. It is still
 * accepted, still means "nothing may be written", and is the one thing it may
 * not be: a way to turn writes on.
 */
function checkReadOnly(resource: Resource, at: string): ValidationError[] {
  const path = `${at}.readOnly`;

  if (resource.readOnly === false) {
    return [
      {
        path,
        message: "`readOnly: false` does not offer any write.",
        expected: "`writes`, naming which writes the resource offers",
        hint: `Remove \`${path}\` and add \`"writes": { "create": true, "update": true }\` to \`${at}\`; a resource says what it offers, not what it is not.`,
      },
    ];
  }

  if (resource.readOnly === true && offersWrites(resource)) {
    return [
      {
        path,
        message: `Resource \`${resource.key}\` is marked \`readOnly\` and also offers writes.`,
        expected: "either `readOnly: true` or `writes`, never both",
        hint: `Remove \`${path}\`; \`writes\` is what a resource offering a form says, and \`readOnly\` is what one offering nothing says.`,
      },
    ];
  }

  return [];
}
