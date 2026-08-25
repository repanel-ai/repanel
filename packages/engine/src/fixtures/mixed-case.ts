import type { DefinitionInput } from "@repanel/contracts";

/**
 * A definition over a Prisma-shaped schema: PascalCase tables, camelCase
 * columns. Postgres folds an unquoted identifier to lower case, so every query
 * built from this one only works if the runtime quotes what it writes — which
 * is why this fixture exists in the unit tests and again against a real
 * database in the integration spec (DECISIONS #022).
 */
export const prismaDefinition: DefinitionInput = {
  schemaVersion: "0.1",
  app: { name: "Prisma Admin" },
  navigation: [{ label: "People", resources: ["User", "Team"] }],
  resources: [
    {
      key: "User",
      label: { singular: "User", plural: "Users" },
      source: { table: "User" },
      primaryKey: "id",
      labelField: "email",
      // `id` is a text key this schema expects the application to issue, so
      // there is no create to offer — only the corrections an operator makes.
      writes: { update: true },
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "email", label: "Email", type: "email", editable: true, required: true },
        { key: "avatarUrl", label: "Avatar", type: "url", editable: true },
        { key: "teamId", label: "Team", type: "relation", target: "Team" },
        { key: "signedUpOn", label: "Signed up", type: "date" },
        { key: "createdAt", label: "Created", type: "dateTime" },
      ],
      relationships: [{ key: "team", kind: "belongsTo", target: "Team", foreignKey: "teamId" }],
      views: {
        table: {
          columns: ["email", "avatarUrl", "teamId", "createdAt"],
          defaultSort: { field: "createdAt", direction: "desc" },
          search: ["email"],
          filters: [{ field: "teamId", kind: "relation" }],
        },
        detail: {
          sections: [{ title: "Account", fields: ["email", "avatarUrl", "teamId", "signedUpOn", "createdAt"] }],
          relatedLists: ["team"],
        },
      },
    },
    {
      key: "Team",
      label: { singular: "Team", plural: "Teams" },
      source: { table: "Team" },
      primaryKey: "id",
      labelField: "displayName",
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "displayName", label: "Name", type: "text" },
        { key: "seatCount", label: "Seats", type: "number" },
      ],
      relationships: [{ key: "members", kind: "hasMany", target: "User", foreignKey: "teamId" }],
      views: {
        table: {
          columns: ["displayName", "seatCount"],
          defaultSort: { field: "displayName", direction: "asc" },
          search: ["displayName"],
          filters: [],
        },
        detail: {
          sections: [{ title: "Team", fields: ["displayName", "seatCount"] }],
          relatedLists: ["members"],
        },
      },
    },
  ],
};
