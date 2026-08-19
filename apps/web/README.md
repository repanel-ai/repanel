# @repanel/web — the console

RePanel's own control plane: sign in, projects, setup. The generated admin that
customers' operators use is a different app (`apps/runtime`); design investment
lands there, not here.

## Running it

```
pnpm dev:api    # the API, on :3001
pnpm dev:web    # this app, on :5173
```

## Talking to the API

The API mounts its routes at the root (`/auth/login`, `/projects`). This app
addresses them under **`/api`**, and the dev server proxies that prefix away —
`/api/auth/login` reaches `/auth/login`. One origin serves the page and its API
in development, so the session cookie has nothing to cross and no CORS is
involved.

`src/lib/api-client.ts` is the only place that convention is written down, and
the only place `fetch` is called.
