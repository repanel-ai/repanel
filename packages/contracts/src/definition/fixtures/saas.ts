import type { DefinitionInput } from "../schema.js";

/**
 * Reference definition for a small SaaS: organizations own users, users place
 * orders. Exercises every v0 concept — every field type, enum tones, hidden
 * and sensitive fields, both relationship kinds, both action kinds, an action
 * precondition, navigation groups, and both writes. `users` carries one field
 * of each type on purpose: it is the record every renderer is reviewed against.
 *
 * The two writable resources are deliberately unlike each other. `users` offers
 * both writes: an operator adds a colleague and corrects what the record says.
 * `orders` offers only `update`, because an order is placed by the application
 * and an operator only ever fixes a typo in one. What neither offers is a form
 * over a field that carries rules — `status`, `is_active` and `plan` each have
 * an action instead, which is the whole of the opt-in philosophy in one
 * fixture.
 */
export const saasDefinition: DefinitionInput = {
  schemaVersion: "0.1",
  app: { name: "Acme Admin" },
  navigation: [
    { label: "Customers", resources: ["organizations", "users"] },
    { label: "Commerce", resources: ["orders"] },
  ],
  resources: [
    {
      key: "organizations",
      label: { singular: "Organization", plural: "Organizations" },
      source: { table: "organizations" },
      primaryKey: "id",
      labelField: "name",
      icon: "building",
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "name", label: "Name", type: "text" },
        { key: "plan", label: "Plan", type: "enum", values: ["free", "pro", "enterprise"] },
        { key: "billing_email", label: "Billing email", type: "email" },
        { key: "settings", label: "Settings", type: "json", hidden: true },
        { key: "created_at", label: "Created", type: "dateTime" },
      ],
      relationships: [{ key: "members", kind: "hasMany", target: "users", foreignKey: "organization_id" }],
      views: {
        table: {
          columns: ["name", "plan", "billing_email", "created_at"],
          defaultSort: { field: "created_at", direction: "desc" },
          search: ["name", "billing_email"],
          filters: [
            { field: "plan", kind: "enum" },
            { field: "created_at", kind: "dateRange" },
          ],
        },
        detail: {
          sections: [
            { title: "Organization", fields: ["name", "plan", "billing_email"] },
            { title: "Configuration", fields: ["settings"] },
            { title: "Activity", fields: ["created_at"] },
          ],
          relatedLists: ["members"],
          // An organization's members are their own subject, so they are
          // reached rather than scrolled past; a user's orders are the point of
          // opening the user, so that record keeps them inline.
          relatedLayout: "tabs",
        },
      },
      actions: [
        {
          key: "upgrade_to_pro",
          label: "Upgrade to Pro",
          confirm: "Move this organization onto the Pro plan?",
          kind: "dbUpdate",
          field: "plan",
          value: "pro",
        },
      ],
    },
    {
      key: "users",
      label: { singular: "User", plural: "Users" },
      source: { table: "users" },
      primaryKey: "id",
      labelField: "email",
      icon: "users",
      writes: { create: true, update: true },
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "email", label: "Email", type: "email", editable: true, required: true },
        { key: "name", label: "Name", type: "text", editable: true, required: true },
        {
          key: "status",
          label: "Status",
          type: "enum",
          values: ["invited", "active", "suspended"],
          // `invited` is deliberately left out: a value with no tone is legal,
          // and it renders exactly as every value did before tones existed.
          tones: { active: "positive", suspended: "critical" },
        },
        // Never editable and never selected. It is also why `status` starts at
        // `invited`: the operator creates the account and the person sets the
        // password, so the column an admin may not write is one it never has to.
        { key: "password_hash", label: "Password hash", type: "text", sensitive: true },
        {
          key: "organization_id",
          label: "Organization",
          type: "relation",
          target: "organizations",
          editable: true,
        },
        { key: "is_active", label: "Active", type: "boolean" },
        { key: "notes", label: "Notes", type: "longText", editable: true },
        { key: "created_at", label: "Created", type: "dateTime" },
        { key: "avatar_url", label: "Avatar", type: "url", editable: true },
        { key: "trial_ends_on", label: "Trial ends", type: "date", editable: true },
        { key: "login_count", label: "Logins", type: "number", editable: true },
        { key: "preferences", label: "Preferences", type: "json", hidden: true },
      ],
      relationships: [
        { key: "organization", kind: "belongsTo", target: "organizations", foreignKey: "organization_id" },
        { key: "orders", kind: "hasMany", target: "orders", foreignKey: "user_id" },
      ],
      views: {
        table: {
          columns: ["email", "name", "status", "organization_id", "created_at"],
          defaultSort: { field: "created_at", direction: "desc" },
          search: ["email", "name", "notes"],
          filters: [
            { field: "status", kind: "enum" },
            { field: "is_active", kind: "boolean" },
            { field: "organization_id", kind: "relation" },
            { field: "created_at", kind: "dateRange" },
          ],
        },
        detail: {
          sections: [
            { title: "Account", fields: ["email", "name", "status", "avatar_url"] },
            {
              title: "Membership",
              fields: ["organization_id", "is_active", "created_at", "trial_ends_on"],
            },
            { title: "Activity", fields: ["login_count", "notes"] },
            { title: "Preferences", fields: ["preferences"] },
          ],
          relatedLists: ["organization", "orders"],
        },
      },
      actions: [
        {
          key: "suspend",
          label: "Suspend",
          confirm: "Suspend this user? They lose access immediately.",
          // There is nothing to suspend a user out of but access they have, so
          // the button is offered on an active one and nowhere else. The other
          // two actions say nothing, which is how every action read before
          // preconditions existed.
          visibleWhen: { field: "status", equals: "active" },
          kind: "dbUpdate",
          field: "status",
          value: "suspended",
        },
        {
          key: "deactivate",
          label: "Deactivate",
          confirm: "Deactivate this user? They lose access until reactivated.",
          kind: "dbUpdate",
          field: "is_active",
          value: false,
        },
        {
          key: "resend_invite",
          label: "Resend invite",
          confirm: "Send the invitation email again?",
          kind: "httpCall",
          method: "POST",
          url: "https://api.acme.test/repanel/users/{id}/resend-invite",
        },
      ],
    },
    {
      key: "orders",
      label: { singular: "Order", plural: "Orders" },
      source: { table: "orders" },
      primaryKey: "id",
      labelField: "reference",
      icon: "receipt",
      // An order is placed by the application; nobody types one into an admin.
      // Correcting the reference it was placed under is the one thing an
      // operator does to it, so `update` is offered and `create` is not.
      writes: { update: true },
      fields: [
        { key: "id", label: "ID", type: "text" },
        { key: "reference", label: "Reference", type: "text", editable: true, required: true },
        { key: "user_id", label: "Customer", type: "relation", target: "users" },
        { key: "status", label: "Status", type: "enum", values: ["pending", "paid", "refunded"] },
        { key: "total_cents", label: "Total (cents)", type: "number" },
        { key: "metadata", label: "Metadata", type: "json" },
        { key: "placed_at", label: "Placed", type: "dateTime" },
      ],
      relationships: [{ key: "customer", kind: "belongsTo", target: "users", foreignKey: "user_id" }],
      views: {
        table: {
          columns: ["reference", "user_id", "status", "total_cents", "placed_at"],
          defaultSort: { field: "placed_at", direction: "desc" },
          search: ["reference"],
          filters: [
            { field: "status", kind: "enum" },
            { field: "user_id", kind: "relation" },
            { field: "placed_at", kind: "dateRange" },
          ],
        },
        detail: {
          sections: [
            { title: "Order", fields: ["reference", "status", "total_cents", "placed_at"] },
            { title: "Customer", fields: ["user_id"] },
            { title: "Raw", fields: ["metadata"] },
          ],
        },
      },
      actions: [
        {
          key: "refund",
          label: "Refund",
          confirm: "Refund this order in full? The customer is notified by email.",
          kind: "httpCall",
          method: "POST",
          url: "https://api.acme.test/repanel/orders/{reference}/refund",
        },
      ],
    },
  ],
};
