import { validateDefinition, type Definition, type RecordDto, type Resource } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";

/**
 * The admin every runtime spec renders: the shared SaaS fixture, put through
 * the same validation the API puts it through, so the specs read exactly what a
 * project's definition endpoint returns — defaults applied, nothing invented.
 */
const result = validateDefinition(saasDefinition);
if (!result.valid) throw new Error("the shared definition fixture no longer validates");

export const adminDefinition: Definition = result.definition;

export function resourceIn(key: string): Resource {
  const resource = adminDefinition.resources.find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`the fixture has no resource \`${key}\``);
  return resource;
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
