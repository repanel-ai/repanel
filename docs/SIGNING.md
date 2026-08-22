# Signing RePanel action requests

When an operator runs an `httpCall` action, RePanel sends one HTTP request to
your application. Your application must be able to tell that request from
anyone else's, because the endpoint behind it does something — refunds an
order, resends an invite, suspends an account — and it is reachable from the
internet.

Every such request is signed with a secret only your project and RePanel hold.
This document is the whole scheme. It is what the per-stack guides point at, and
it is checked against the code that produces the signature by a test in this
repo (`apps/api/src/actions/signing-doc.spec.ts`) — the snippet below is read out
of this file and run against a request the real signer produced, so it cannot
drift from what RePanel actually sends.

## The secret

One per project, minted the first time it is needed and stored encrypted. Read
it once, from the signed-in owner's session:

```
GET /projects/:id/action-secret   →   { "secret": "…" }
```

It is 32 random bytes rendered base64url, and **the string is the key**: both
sides feed those characters to HMAC as UTF-8, and neither decodes them first.
Put it in your application's secret store under a name of your choosing — the
convention in the per-stack guides is `REPANEL_ACTION_SECRET`.

There is no rotation in v0. DECISIONS #013 records how it will work when it
lands: two secrets accepted at once, so a rollout never has a moment where one
side is ahead of the other.

## The request

```
POST /repanel/users/8f2c1a/resend-invite HTTP/1.1
Host: api.example.com
Repanel-Timestamp: 1787059200
Repanel-Signature: v1=6f0d…c31b
```

- The method and the URL are the ones your definition wrote down, with each
  `{field_key}` replaced by that field's current value on the record, percent
  encoded. RePanel reads those values from your database itself; the browser
  contributes only which record and which action.
- **There is no body.** v0 actions carry no inputs, so there is nothing to send
  and nothing to parse. When a body arrives it will join the signed payload
  behind a new version prefix, never quietly inside `v1`.
- Redirects are not followed. The signature covers the address your definition
  named, so a hop would arrive somewhere else carrying proof for somewhere else.
  A 3xx is read as your application declining to handle the action.
- The request is given 10 seconds to be answered. Any 2xx is success; every
  other outcome is reported to the operator as a category — refused, could not
  be reached, timed out — and your response body is never read or forwarded.

## What is signed

```
<timestamp> "." <METHOD> " " <URL>
```

for example

```
1787059200.POST https://api.example.com/repanel/users/8f2c1a/resend-invite
```

The signature is `v1=` followed by the lowercase hex HMAC-SHA256 of that string
under the secret. The URL is exactly the one requested, including its scheme,
host and query string.

The timestamp is inside the payload as well as in a header, which is the whole
point of it: refusing an old timestamp refuses a replay, and a timestamp an
attacker could rewrite would refuse nothing.

## Verifying it

Two things have to be true, and both matter:

1. the signature matches, compared in constant time;
2. the timestamp is recent — five minutes is the usual tolerance, and it is what
   stops a request captured today from working tomorrow.

<!-- verification snippet: read and executed by signing-doc.spec.ts -->

```js
const { createHmac, timingSafeEqual } = require("node:crypto");

/** How long a signed request stays acceptable. Five minutes is the convention. */
const TOLERANCE_SECONDS = 300;

/**
 * Whether one request really came from RePanel.
 *
 * `method` and `url` must be the ones actually requested — the full absolute
 * URL, not the path your router matched — because that is what was signed.
 */
function verifyRepanelRequest({ secret, method, url, timestamp, signature, now }) {
  if (typeof timestamp !== "string" || !/^\d+$/.test(timestamp)) return false;
  if (typeof signature !== "string" || !signature.startsWith("v1=")) return false;

  const seconds = now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(seconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const expected =
    "v1=" + createHmac("sha256", secret).update(`${timestamp}.${method} ${url}`).digest("hex");

  const sent = Buffer.from(signature, "utf8");
  const ours = Buffer.from(expected, "utf8");
  // Length first: timingSafeEqual throws on a mismatch, and the length of a
  // hex digest is not a secret.
  return sent.length === ours.length && timingSafeEqual(sent, ours);
}

module.exports = { verifyRepanelRequest, TOLERANCE_SECONDS };
```

Wired into an Express-style middleware, in front of every route in your admin
module and nothing else:

```js
app.use("/repanel", (req, res, next) => {
  const ok = verifyRepanelRequest({
    secret: process.env.REPANEL_ACTION_SECRET,
    method: req.method,
    url: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
    timestamp: req.get("Repanel-Timestamp"),
    signature: req.get("Repanel-Signature"),
  });

  if (!ok) return res.status(401).json({ error: "bad signature" });
  next();
});
```

Reconstructing the URL is the one place this goes wrong in practice. It has to
be the address RePanel requested, byte for byte: if your application sits behind
a proxy that terminates TLS or rewrites a prefix, read the forwarded scheme and
host rather than the socket's, and make sure the path still carries the prefix
the definition named.

## Answering

Any 2xx means the action succeeded. RePanel shows the operator the action's own
label and refreshes the record, so whatever your endpoint changed appears
immediately — including a status the admin renders as a badge.

Anything else is a failure, and the operator is told which kind. Nothing from
your response reaches their browser, so put the detail in your own logs: a
message that would help you is a message only you will see.
