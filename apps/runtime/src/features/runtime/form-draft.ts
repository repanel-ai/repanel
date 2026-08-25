import type {
  Field,
  JsonValue,
  RecordDto,
  RecordValue,
  RecordValues,
  Resource,
  WriteMode,
} from "@repanel/contracts";
import { refuseWriteTo } from "@repanel/contracts";

/**
 * What one control holds. `undefined` is not a value: it is the field having no
 * answer yet, which on a new record means the column's own default stands and
 * on an existing one cannot happen, because every field starts at what the
 * record says. `null` *is* an answer — the operator emptied it.
 */
export type DraftValue = JsonValue | undefined;

/** Every editable field's current answer, keyed by field. */
export type FormDraft = Record<string, DraftValue>;

/**
 * The fields a form draws, in the order the resource declares them.
 *
 * It asks `refuseWriteTo` — the write path's own predicate — rather than
 * reading the `editable` flag alone, because `editable` is one of several
 * things that decide whether a column may be written, and a definition stored
 * before one of the others existed still has to render. The engine checks them
 * all twice for exactly that reason (DECISIONS #056); this is the same question
 * asked a third time, where the controls are drawn, so a form cannot put a box
 * on the screen over a value the write would refuse.
 *
 * It is asked per mode because one answer differs between the two: a primary
 * key the client issues is chosen when the record is made and never after, so
 * it is a control on the create form and on nothing else (DECISIONS #059). A
 * generated key is on neither.
 */
export function formFields(resource: Resource, mode: WriteMode): Field[] {
  return resource.fields.filter((field) => refuseWriteTo(resource, field, mode) === undefined);
}

/**
 * The answers a form opens with.
 *
 * A record being corrected seeds each control from what it holds; a new one
 * seeds nothing, so a field nobody fills in is left out of the write entirely
 * and the column's default is what lands. Writing `null` there instead would be
 * the admin deciding that "I did not say" means "nothing", which is the same
 * mistake the write path refuses to make about an empty box.
 */
export function draftFor(
  resource: Resource,
  mode: WriteMode,
  record: RecordDto | undefined,
): FormDraft {
  const draft: FormDraft = {};
  for (const field of formFields(resource, mode)) {
    draft[field.key] = record ? asDraft(record.values[field.key] ?? null) : undefined;
  }
  return draft;
}

/**
 * What of the draft goes on the wire: the answers that differ from what the
 * form opened with, and nothing else.
 *
 * On a new record that is everything anybody typed. On an existing one it is
 * the change and only the change — which is what `PATCH` means, and what keeps
 * last-write-wins (DECISIONS #056) from meaning that whoever saved last wrote
 * every column of the record.
 */
export function changedIn(draft: FormDraft, seed: FormDraft): RecordValues {
  const values: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(draft)) {
    if (value === undefined || same(value, seed[key])) continue;
    values[key] = value;
  }
  return values;
}

/** Whether anything at all would be written. */
export function hasChanges(draft: FormDraft, seed: FormDraft): boolean {
  return Object.keys(changedIn(draft, seed)).length > 0;
}

/**
 * One value of a record, as the control that edits it holds it. A relation
 * reads as a key and a label and is written as a key alone: the label is the
 * other record's, and there is nothing on this one to write it to.
 */
function asDraft(value: RecordValue): DraftValue {
  if (value !== null && typeof value === "object" && !Array.isArray(value) && "id" in value) {
    return value.id as JsonValue;
  }
  return value;
}

/**
 * Whether two answers are the same answer.
 *
 * Both sides are scalars — `json` is not a writable type (DECISIONS #055) and a
 * relation has already been reduced to its key — but they do not always arrive
 * as the same *kind* of scalar. A control hands back the digits somebody typed
 * and the record kept the number they were read as, so `1284` and `"1284"` are
 * one answer written twice. A form that called them different would offer to
 * write a value nobody changed, and would ask before discarding a change
 * nobody made.
 *
 * Only those two are read across: `null` is never `""` and `true` is never
 * `"true"`, which are exactly the distinctions the write path exists to keep.
 */
function same(value: DraftValue, seeded: DraftValue): boolean {
  if (value === seeded) return true;
  return typed(value) === typed(seeded);
}

function typed(value: DraftValue): DraftValue {
  return typeof value === "number" || typeof value === "string" ? String(value) : value;
}
