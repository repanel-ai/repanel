import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How long a signed request stays acceptable. Five minutes is the convention in
 * docs/SIGNING.md, which is the scheme this file implements — SkyScout writes
 * nothing of its own here, it reproduces what RePanel sends.
 */
export const TOLERANCE_SECONDS = 300;

/** Where the two halves of the proof arrive. Express lowercases header names. */
export const TIMESTAMP_HEADER = "repanel-timestamp";
export const SIGNATURE_HEADER = "repanel-signature";

/** The scheme's name, sent as the signature's prefix. An unknown one is refused. */
const VERSION = "v1";

export interface VerifiableRequest {
  /** The project's action secret, verbatim: the string itself is the key. */
  secret: string;
  method: string;
  /** The absolute URL as requested — not the route pattern that matched it. */
  url: string;
  timestamp?: string;
  signature?: string;
  /** Unix seconds, injectable so a test can age a request rather than wait. */
  now?: number;
}

/**
 * Whether one request really came from RePanel.
 *
 * Two things have to be true and both matter: the signature matches, compared
 * in constant time, and the timestamp is recent. A signature alone is valid
 * forever, so it is the timestamp that turns a captured request into an expired
 * one — which is why RePanel signs the timestamp as well as sending it.
 */
export function verifyRepanelRequest({
  secret,
  method,
  url,
  timestamp,
  signature,
  now,
}: VerifiableRequest): boolean {
  if (typeof timestamp !== "string" || !/^\d+$/.test(timestamp)) return false;
  if (typeof signature !== "string" || !signature.startsWith(`${VERSION}=`)) return false;

  const seconds = now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(seconds - Number(timestamp)) > TOLERANCE_SECONDS) return false;

  const digest = createHmac("sha256", secret).update(`${timestamp}.${method} ${url}`).digest("hex");
  const sent = Buffer.from(signature, "utf8");
  const ours = Buffer.from(`${VERSION}=${digest}`, "utf8");

  // Length first: timingSafeEqual throws on a mismatch, and the length of a hex
  // digest is not a secret.
  return sent.length === ours.length && timingSafeEqual(sent, ours);
}
