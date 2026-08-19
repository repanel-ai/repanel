# @repanel/runtime — the generated admin

The product's face: the admin interface rendered from a customer's definition.
Task 010 builds the renderer; today this is the shell it grows into.

## What this app may import

**`@repanel/ui`, `@repanel/contracts`, and itself.** Nothing from `apps/web`,
nothing from `apps/api`. The rule is kept by structure rather than by lint: the
console and the renderer are separate apps precisely so that the renderer can
be versioned, domained, and deployed on its own.

## Running it

```
pnpm dev:api        # the API, on :3001
pnpm dev:runtime    # this app, on :5174
```

Then open `http://localhost:5174/a/<project-key>`.

## Talking to the API

Control-plane routes are addressed under **`/api`**, with the prefix stripped by
the proxy (`/api/auth/me` reaches `/auth/me`). The runtime data API is proxied
at **`/runtime`** under its own name, which is where 010 reads records from.

`src/lib/api-client.ts` is the only place `fetch` is called. It duplicates the
console's client deliberately — the two apps' API surfaces diverge, and a
shared client would have to carry every endpoint either of them needs.

## Signing in

The runtime has no login screen. An unauthenticated visitor is directed to the
console, whose address comes from `VITE_CONSOLE_URL` (default
`http://localhost:5173`).
