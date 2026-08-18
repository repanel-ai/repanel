# RePanel Vision (condensed)

**Category:** the admin runtime for modern applications.
**Promise:** your app is built — RePanel gives it a proper admin, without
creating a second application to maintain.

## The loop

1. Developer creates a RePanel project and connects their coding agent via MCP.
2. The agent inspects the customer repository — models, schema, APIs, validation,
   enums, authorization — and generates a **definition**: resources, fields,
   relationships, views, filters, and safe actions.
3. RePanel validates the definition, renders a hosted preview with its maintained
   runtime, and the developer publishes an immutable snapshot.
4. When the app changes, the developer asks the agent to update the definition.

## The five layers

Customer application (owns data + business logic) → coding agent (intelligence,
authoring) → control plane (workspaces, projects, connections, drafts, publishing)
→ validation/compilation (definition → runtime-ready form) → runtime (renders
tables, details, forms, actions; owns all presentation quality).

## Principles (binding)

- **No blank canvas.** Inferred resources and strong defaults, never an empty builder.
- **Convention over configuration.** The definition expresses intent and
  exceptions, not layout. It must never become a UI component tree.
- **Application-aware, not database-only.** Repository context (rules, endpoints,
  sensitive fields) is the differentiator over DB-browser tools.
- **Safe by default.** Aggressive read inference, conservative writes. Low
  confidence → read-only + existing API actions + confirmation.
- **Bring your own agent.** MCP is the only authoring interface. No internal
  model in the core loop, no generation credits.
- **Customer owns the definition** (in their repo, git-reviewed, portable).
  **RePanel owns the runtime** (layout, interaction, accessibility, upgrades).
- **Open by default.** Self-hosted and Cloud run the same core; Cloud wins on
  service, never on artificially gated features.

## What RePanel is not

Not a general internal-app builder, not a frontend framework in YAML, not a
workflow engine, not a BI tool, not a generated-code factory, not a replacement
for customer business logic.

## North-star metric

Time from connecting an existing application to publishing a useful admin.
