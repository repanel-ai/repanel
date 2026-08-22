import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { HttpCallService } from "./http-call.service";

/**
 * docs/SIGNING.md is what every per-stack guide points at, and it is the only
 * description of the scheme a customer will ever read. A document that has
 * drifted from the signer is worse than no document: it sends someone away to
 * debug a signature that was never going to match.
 *
 * So the snippet is not transcribed here — it is read out of the document,
 * executed, and pointed at a request the real signer produced and a real HTTP
 * server received. If the scheme changes and the document does not, this fails.
 */
const SIGNING_MD = join(__dirname, "..", "..", "..", "..", "docs", "SIGNING.md");

/** Marks the fence this spec runs. It is in the document, above the snippet. */
const MARKER = "<!-- verification snippet: read and executed by signing-doc.spec.ts -->";

interface Verifiable {
  secret: string;
  method: string;
  url: string;
  timestamp?: string;
  signature?: string;
  now?: number;
}

interface Snippet {
  verifyRepanelRequest: (request: Verifiable) => boolean;
  TOLERANCE_SECONDS: number;
}

/** The snippet as the document publishes it, loaded as the module it claims to be. */
function documentedVerifier(): Snippet {
  const document = readFileSync(SIGNING_MD, "utf8");
  const after = document.split(MARKER)[1];
  if (after === undefined) throw new Error(`docs/SIGNING.md no longer carries \`${MARKER}\``);

  const fenced = /```js\n([\s\S]*?)```/.exec(after);
  const code = fenced?.[1];
  if (!code) throw new Error("docs/SIGNING.md has no javascript block after the marker");

  const load = new Function("require", "module", "exports", code) as (
    require: unknown,
    module: { exports: unknown },
    exports: unknown,
  ) => void;
  const module = { exports: {} as Snippet };
  load(require, module, module.exports);
  return module.exports;
}

const SECRET = "0DkY6qKcqz3ThQ1lQ1yQmSTQ0Fq0MHQ9Q8oXwq3M2mA";

/** One request as the customer's application received it, headers and all. */
interface Captured {
  method: string;
  url: string;
  timestamp?: string;
  signature?: string;
}

/**
 * A request the real signer produced, taken off the wire the way the customer's
 * middleware takes it: from the method, the reconstructed URL and the headers.
 */
async function capture(method: "POST" | "DELETE" = "POST"): Promise<Captured> {
  let received: IncomingMessage | undefined;
  const server: Server = createServer((request, response) => {
    received = request;
    response.writeHead(200).end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}/repanel/users/u_1/resend-invite`;

  await new HttpCallService().send({ method, url, secret: SECRET });
  await new Promise<void>((resolve) => server.close(() => resolve()));

  if (!received) throw new Error("the fake application received nothing");
  return {
    // Rebuilt exactly as the document tells a customer to rebuild it.
    method: received.method ?? "",
    url: `http://${received.headers.host ?? ""}${received.url ?? ""}`,
    timestamp: received.headers["repanel-timestamp"] as string | undefined,
    signature: received.headers["repanel-signature"] as string | undefined,
  };
}

describe("the verification snippet in docs/SIGNING.md", () => {
  const { verifyRepanelRequest, TOLERANCE_SECONDS } = documentedVerifier();
  let sent: Captured;

  beforeAll(async () => {
    sent = await capture();
  });

  it("verifies a request RePanel actually signed and sent", () => {
    expect(verifyRepanelRequest({ ...sent, secret: SECRET })).toBe(true);
  });

  it("verifies a request under any method the schema allows", async () => {
    const deleted = await capture("DELETE");

    expect(verifyRepanelRequest({ ...deleted, secret: SECRET })).toBe(true);
  });

  it("refuses the same request under a different secret", () => {
    expect(verifyRepanelRequest({ ...sent, secret: `${SECRET}x` })).toBe(false);
  });

  it.each([
    ["the method", { method: "GET" }],
    ["the url", { url: "http://127.0.0.1:9/repanel/users/u_2/resend-invite" }],
    ["the timestamp", { timestamp: String(Math.floor(Date.now() / 1000) + 1) }],
    ["the signature", { signature: `v1=${"0".repeat(64)}` }],
  ])("refuses a request with %s changed in flight", (_part, difference) => {
    expect(verifyRepanelRequest({ ...sent, ...difference, secret: SECRET })).toBe(false);
  });

  it("refuses a signature from a version it does not know", () => {
    const forged = (sent.signature ?? "").replace("v1=", "v2=");

    expect(verifyRepanelRequest({ ...sent, signature: forged, secret: SECRET })).toBe(false);
  });

  it.each([["missing"], ["not a number"]])("refuses a timestamp that is %s", (kind) => {
    const timestamp = kind === "missing" ? undefined : "yesterday";

    expect(verifyRepanelRequest({ ...sent, timestamp, secret: SECRET })).toBe(false);
  });

  /** A valid signature is valid forever; a timestamp is what stops a replay. */
  it("refuses a perfectly good signature that is too old to still be meant", () => {
    const later = Number(sent.timestamp) + TOLERANCE_SECONDS + 1;

    expect(verifyRepanelRequest({ ...sent, secret: SECRET, now: later })).toBe(false);
    expect(verifyRepanelRequest({ ...sent, secret: SECRET, now: later - 2 })).toBe(true);
  });

  it("refuses a timestamp from further ahead than a clock can drift", () => {
    const earlier = Number(sent.timestamp) - TOLERANCE_SECONDS - 1;

    expect(verifyRepanelRequest({ ...sent, secret: SECRET, now: earlier })).toBe(false);
  });

  it("allows the five minutes the document says it allows", () => {
    expect(TOLERANCE_SECONDS).toBe(300);
  });
});
