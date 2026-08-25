# Licensing, in plain language

[`LICENSES.md`](../LICENSES.md) is the map: which licence covers which package,
and which file is authoritative. This page is what the map *means* for you, in
the three shapes the question actually arrives in.

At a glance, with `LICENSES.md` authoritative:

- **MIT** — `packages/contracts`, `examples/crewbase`
- **Apache-2.0** — `packages/engine`, `packages/cli`
- **AGPL-3.0-only** — `apps/api`, `apps/web`, `apps/runtime`, `packages/ui`,
  and everything else in this repository by default

One sentence carries the whole design (#053): **what you build against is
permissive; what we operate is copyleft.** The definition schema, the engine
and the CLI are the surfaces a customer integrates with and embeds, so a
copyleft licence on them would tax adoption without protecting anything. The
hosted product and its face are RePanel-the-service, and those are copyleft on
purpose.

This is a plain-language explanation written by the maintainers, not legal
advice. If your situation is one where the answer matters commercially,
have your own counsel read the licence texts — they are in this repository,
verbatim, and where they and this page differ, they govern.

## Can my company use this?

| What you want to do | What you are using | What it costs you |
|---|---|---|
| **Self-host RePanel for your own operators.** Run the console and the admin inside your company, against your own database, modified or not. | All of it: `apps/*` and `packages/ui` under AGPL-3.0-only, the rest as marked. | **Nothing leaves your company.** AGPL-3.0 §13's obligation runs to the people interacting with your modified version over a network — and those people are your own staff, who can be handed the source across the desk. Nothing obliges you to publish, and nothing reaches your other software. |
| **Offer a hosted admin product built on RePanel to other people.** A competing service, a white-labelled panel, RePanel inside your SaaS. | `apps/api`, `apps/web`, `apps/runtime`, `packages/ui` — AGPL-3.0-only. | **Your modifications are AGPL-3.0-only, and your users are entitled to them.** §13 means everyone interacting with your modified version over the network can ask for its Corresponding Source. A proprietary product that links these packages is a combined work under the same terms. This is the one case the split exists to cover, and it is not an oversight you can engineer around. |
| **Embed the permissive packages in your own product.** Validate definitions, run the engine in your own process, ship the CLI in your toolchain, copy the example app. | `@repanel/contracts` (MIT), `@repanel/engine` (Apache-2.0), `@repanel/cli` (Apache-2.0), `examples/crewbase` (MIT). | **Attribution, and that is all.** Keep the licence text and the copyright notice; Apache-2.0 adds a patent grant in your favour and a NOTICE-file rule that applies where a NOTICE exists (this repository ships none). No copyleft reaches your code, no source obligation, no disclosure. |

## "Our organization does not allow AGPL"

Read the third row again, because it is the answer: **everything you integrate
with and embed is Apache-2.0 or MIT.** The definition schema your agent writes
against is MIT (`@repanel/contracts`). The safety core that reads your database
is Apache-2.0 (`@repanel/engine`). The command your developers install is
Apache-2.0 (`@repanel/cli`). None of those pull an AGPL package into your
product, and Apache-2.0 carries the explicit patent grant that most policies
are actually written to obtain.

And **running an AGPL surface triggers nothing at all.** Neither licence has
anything to say about use: you can run RePanel — hosted by us or self-hosted —
without any obligation attaching to your own code, because you are not
conveying anything to anyone. An AGPL policy is a rule about what enters your
product; nothing here enters it unless you put it there.

The one qualifier, stated so you do not have to find it: if you *modify* a
self-hosted RePanel and your staff use it over the network, §13 entitles those
staff to your modified source. They are your employees and it is your source.
That is the whole of it.

## One thing a scanner will find on its own

`packages/cli` is Apache-2.0, and every file in it is Apache-2.0. Its *build
step* is separate: it copies the compiled `apps/runtime` into
`packages/cli/dist/runtime`, so that `repanel dev` serves the same admin the
hosted product does rather than a second build of it (#048). A **built**
`repanel` therefore carries AGPL-3.0 code beside its own Apache-2.0 code.

Who this binds:

- **Running it — nothing.** Running `repanel dev` imposes no obligation under
  either licence. Use is not distribution.
- **Redistributing a build — you.** Shipping a built `repanel` inside your own
  artifact is a distribution of `apps/runtime` under AGPL-3.0, and you owe the
  Corresponding Source. The source that build is made from is this repository,
  which is the offer §6 asks for.

We say this on the page rather than leave a licence scanner to discover it and
draw its own conclusion (#053).

## Why it is split where it is

The engine is Apache-2.0 rather than copyleft, and that was the ruling worth
recording. It has to be *embeddable*: `repanel dev` runs it on a developer's
machine, and the connector ([task 031](tasks/031-connector.md)) will run it
inside a customer's own network. Those are the activation and enterprise-trust
surfaces — the two places where an AGPL-policy conversation costs a customer we
would otherwise have had. The MIT-contracts precedent settled the principle for
the surface a customer's agent writes against; the engine is the same argument
one layer down (#053).

The moat is runtime quality and Cloud operations, never secret code. That is
why self-hosting is a first-class answer here rather than a grudging one — the
AGPL exists to keep a modified RePanel open, not to keep you off it. If holding
your own database credential matters more to you than convenience, self-hosting
and the connector are both real answers, and
[`THREAT-MODEL.md`](THREAT-MODEL.md) says exactly what each one changes.

`examples/crewbase` is MIT because it exists to be copied. It is a reference
customer application, not part of the product — and a deliberately trap-laden
one, which its own `README.md` explains.

## Contributing, and copyright

Contributions come in under the licence of the package they touch, on a
Developer Certificate of Origin sign-off rather than a CLA: contributors keep
their copyright, and there is no assignment to sign (#053). See
[`CONTRIBUTING.md`](../CONTRIBUTING.md) and
[`DEVELOPER_CERTIFICATE`](../DEVELOPER_CERTIFICATE).

There are no per-file SPDX headers. The authority is the package's `LICENSE`
plus the `license` field in its `package.json` — two places a scanner and a
human already read, which cannot drift from each other the way thousands of
copied header comments can. A new package needs both; a new file needs neither.

Copyright © 2026 RePanel.
