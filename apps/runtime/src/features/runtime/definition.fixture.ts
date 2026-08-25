import {
  validateDefinition,
  type Definition,
  type RecordDto,
  type RecordOptionDto,
  type Resource,
} from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";

/**
 * The admin every runtime spec renders: the shared SaaS fixture, put through
 * the same validation the API puts it through, so the specs read exactly what a
 * project's definition endpoint returns — defaults applied, nothing invented.
 */
const result = validateDefinition(saasDefinition);
if (!result.valid) throw new Error("the shared definition fixture no longer validates");

export const adminDefinition: Definition = result.definition;

export function resourceIn(key: string, definition: Definition = adminDefinition): Resource {
  const resource = definition.resources.find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`the fixture has no resource \`${key}\``);
  return resource;
}

/**
 * The same admin with one resource offering only the actions named.
 *
 * The shared fixture's `users` declares three actions and only one of them says
 * when it applies, so it can never reach the state a record is in when there is
 * nothing left to do to it. That state is where the header stops drawing an
 * action row at all, and a spec has to be able to get to it.
 */
export function adminOffering(resourceKey: string, actionKeys: readonly string[]): Definition {
  return {
    ...adminDefinition,
    resources: adminDefinition.resources.map((resource) =>
      resource.key === resourceKey
        ? { ...resource, actions: resource.actions.filter((action) => actionKeys.includes(action.key)) }
        : resource,
    ),
  };
}


/**
 * The same admin with one resource's named fields opened for editing.
 *
 * The shared fixture keeps `status` behind an action on purpose — a field that
 * carries rules is not a form's to write, and saying so is the whole of the
 * opt-in philosophy it teaches. A form still has to be able to draw an editable
 * enum, tones and all, so a spec opens one here rather than by weakening what
 * the fixture teaches everywhere else.
 */
export function adminEditing(resourceKey: string, fieldKeys: readonly string[]): Definition {
  return {
    ...adminDefinition,
    resources: adminDefinition.resources.map((resource) =>
      resource.key === resourceKey
        ? {
            ...resource,
            writes: { create: true, update: true },
            fields: resource.fields.map((field) =>
              fieldKeys.includes(field.key) ? { ...field, editable: true } : field,
            ),
          }
        : resource,
    ),
  };
}

/**
 * The same admin over a table whose keys are chosen rather than generated: the
 * resource declares `primaryKeyGeneration: "client"` and opens its key field
 * for writing. It is the one shape in which a primary key reaches a form at
 * all, and a form has to draw it on a record being made and on nothing else.
 */
export function adminKeyedByClient(resourceKey: string): Definition {
  return {
    ...adminDefinition,
    resources: adminDefinition.resources.map((resource) =>
      resource.key === resourceKey
        ? {
            ...resource,
            primaryKeyGeneration: "client",
            writes: { create: true, update: true },
            fields: resource.fields.map((field) =>
              field.key === resource.primaryKey ? { ...field, editable: true, required: true } : field,
            ),
          }
        : resource,
    ),
  };
}

/** Two users, covering an enum, a relation, a boolean and a timestamp. */
export const userRecords: RecordDto[] = [
  {
    id: "u_1",
    values: {
      email: "maya.okonkwo@northwind.io",
      name: "Maya Okonkwo",
      status: "active",
      organization_id: { id: "o_1", label: "Northwind Labs" },
      is_active: true,
      created_at: "2026-07-14T09:12:00.000Z",
    },
  },
  {
    id: "u_2",
    values: {
      email: "p.laurent@meridian.fr",
      name: "Paul Laurent",
      status: "invited",
      organization_id: { id: null, label: null },
      is_active: false,
      created_at: "2026-07-11T08:03:00.000Z",
    },
  },
];

/** One organization, for the `belongsTo` list a user's record hangs off. */
export const organizationRecords: RecordDto[] = [
  {
    id: "o_1",
    values: {
      id: "o_1",
      name: "Northwind Labs",
      plan: "enterprise",
      billing_email: "accounts@northwind.io",
      created_at: "2025-11-02T14:30:00.000Z",
    },
  },
];

/** Two orders, covering a quantity, a json blob and a relation with a label. */
export const orderRecords: RecordDto[] = [
  {
    id: "o_1001",
    values: {
      reference: "AC-10241",
      user_id: { id: "u_1", label: "maya.okonkwo@northwind.io" },
      status: "paid",
      total_cents: 1240000,
      metadata: { channel: "web", coupon: "SPRING24" },
      placed_at: "2026-07-14T11:41:00.000Z",
    },
  },
  {
    id: "o_1002",
    values: {
      reference: "AC-10242",
      user_id: { id: "u_2", label: "p.laurent@meridian.fr" },
      status: "pending",
      total_cents: 4900,
      metadata: { channel: "api" },
      placed_at: "2026-07-13T16:05:00.000Z",
    },
  },
];

/**
 * One user in full: a value of every field type the definition has, which is
 * what makes it the record every detail renderer is reviewed against.
 */
export const userRecord: RecordDto = {
  id: "u_1",
  values: {
    id: "u_1",
    email: "maya.okonkwo@northwind.io",
    name: "Maya Okonkwo",
    status: "active",
    avatar_url: "https://cdn.northwind.io/avatars/maya-okonkwo.png",
    organization_id: { id: "o_1", label: "Northwind Labs" },
    is_active: true,
    created_at: "2026-07-14T09:12:00.000Z",
    trial_ends_on: "2026-08-30",
    login_count: 1284,
    notes: "Asked for SSO before the September rollout.\n\nInvoicing goes to accounts@northwind.io, not to this address.",
    preferences: { theme: "dark", digest: "weekly", locale: "en-GB", beta: ["insights", "audit-log"] },
  },
};

/** The same record with its optional half empty, so every nothing is drawn. */
export const sparseUserRecord: RecordDto = {
  id: "u_2",
  values: {
    id: "u_2",
    email: "p.laurent@meridian.fr",
    name: null,
    status: "invited",
    avatar_url: null,
    organization_id: { id: null, label: null },
    is_active: false,
    created_at: "2026-07-11T08:03:00.000Z",
    trial_ends_on: null,
    login_count: 0,
    notes: null,
    preferences: null,
  },
};

/** One organization in full — the record whose related list is a tab. */
/** What the picker over `organizations` is answered with. */
export const organizationOptions: RecordOptionDto[] = [
  { id: "o_1", label: "Northwind Labs" },
  { id: "o_2", label: "Ridgeline" },
];

export const organizationRecord: RecordDto = {
  id: "o_1",
  values: {
    id: "o_1",
    name: "Northwind Labs",
    plan: "enterprise",
    billing_email: "accounts@northwind.io",
    settings: { seats: 250, sso: "okta", retention_days: 730 },
    created_at: "2025-11-02T14:30:00.000Z",
  },
};
