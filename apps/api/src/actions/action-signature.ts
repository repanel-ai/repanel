import { createHmac } from "node:crypto";

/**
 * Names the scheme, so a second one can arrive beside this one rather than
 * replacing it. A verifier that does not recognize the version must refuse.
 */
const VERSION = "v1";

/** Where the two halves of the proof travel. */
export const TIMESTAMP_HEADER = "Repanel-Timestamp";
export const SIGNATURE_HEADER = "Repanel-Signature";

export interface SignedRequest {
  /** The project's action secret, verbatim: both sides feed these characters to HMAC. */
  secret: string;
  /** Unix seconds. It is signed as well as sent, so it cannot be edited in flight. */
  timestamp: number;
  method: string;
  /** The absolute URL as it will be requested, placeholders already filled. */
  url: string;
}

/**
 * What is signed: the timestamp, then the request line.
 *
 * The timestamp is inside the payload rather than only beside it, which is what
 * makes it worth anything — a verifier that refuses an old timestamp is
 * refusing a replay, and a timestamp an attacker could rewrite would refuse
 * nothing. The method and the URL are the whole of the request in v0, because
 * v0 sends no body; when a body arrives it joins the payload behind a new
 * version, never quietly inside this one.
 */
export function signedPayload({ timestamp, method, url }: Omit<SignedRequest, "secret">): string {
  return `${timestamp}.${method} ${url}`;
}

/**
 * The two headers a signed request carries. Everything about the scheme that a
 * customer's application has to reproduce is here and in docs/SIGNING.md, and
 * those two are checked against each other by a spec — a signing scheme
 * documented from memory is a signing scheme nobody can verify.
 */
export function signRequest(request: SignedRequest): Record<string, string> {
  const digest = createHmac("sha256", request.secret).update(signedPayload(request)).digest("hex");

  return {
    [TIMESTAMP_HEADER]: String(request.timestamp),
    [SIGNATURE_HEADER]: `${VERSION}=${digest}`,
  };
}
