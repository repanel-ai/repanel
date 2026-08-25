# Licensing

RePanel is multi-licensed by package. **AGPL-3.0-only is the repository's
default**: anything not covered by a package `LICENSE` file below is under the
`LICENSE` at the root. Where a package carries its own `LICENSE`, that file is
authoritative for everything in it.

This page is the map. The plain-language "can my company use this?" answers live
in [`docs/LICENSING.md`](docs/LICENSING.md).

## The map

| Package | License | SPDX |
|---|---|---|
| `packages/contracts` | MIT | `MIT` |
| `packages/engine` | Apache License 2.0 | `Apache-2.0` |
| `packages/cli` | Apache License 2.0 | `Apache-2.0` |
| `packages/ui` | GNU Affero General Public License v3.0 | `AGPL-3.0-only` |
| `apps/api` | GNU Affero General Public License v3.0 | `AGPL-3.0-only` |
| `apps/web` | GNU Affero General Public License v3.0 | `AGPL-3.0-only` |
| `apps/runtime` | GNU Affero General Public License v3.0 | `AGPL-3.0-only` |
| `examples/crewbase` | MIT | `MIT` |
| *(everything else)* | GNU Affero General Public License v3.0 | `AGPL-3.0-only` |

Every package repeats its identifier in the `license` field of its
`package.json`, so a scanner and a reader are told the same thing.

## Why it is split this way

**The things you build against are permissive.** `@repanel/contracts` is the
definition schema — the public product contract your repository holds and your
agent writes. `@repanel/engine` is the safety core that reads your database, and
`@repanel/cli` is what runs it on your machine. These are the surfaces a
customer integrates with and, in the engine's case, embeds; a copyleft license
on them would tax adoption without protecting anything. The moat is runtime
quality and Cloud operations, never secret code.

**The hosted product is copyleft.** `apps/api`, `apps/web`, `apps/runtime` and
`packages/ui` are RePanel-the-service and its face. AGPL-3.0's §13 is the point:
run a modified RePanel as a network service and your users are entitled to your
modifications. Self-hosting RePanel for your own operators triggers nothing —
you are not offering it to third parties.

**`examples/crewbase` is MIT because it exists to be copied.** It is a reference
customer application, not part of the product.

## One thing the table cannot say on its own

`packages/cli` is Apache-2.0, and every file in `packages/cli/` is Apache-2.0.
Its *build step* is separate: `scripts/embed-runtime.mjs` copies the compiled
`apps/runtime` into `packages/cli/dist/runtime`, so that `repanel dev` serves
the same admin the hosted product does rather than a second build of it
(decision #048). A **built** CLI therefore contains AGPL-3.0 code alongside its
own Apache-2.0 code.

For someone running `repanel dev`, this changes nothing: use imposes no
obligation under either license. It matters only if you redistribute a built
CLI, which is then a distribution of `apps/runtime` under AGPL-3.0. The source
that build is made from is this repository, which is the offer AGPL-3.0 §6
asks for.

## Copyright

Copyright © 2026 RePanel.

The AGPL-3.0 and Apache-2.0 texts in this repository are reproduced verbatim
and are not modified by anything on this page. Where they and this page differ,
they govern.

## Contributing

Contributions are accepted under the license of the package they touch, on a
Developer Certificate of Origin sign-off rather than a CLA. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) and [`DEVELOPER_CERTIFICATE`](DEVELOPER_CERTIFICATE).
