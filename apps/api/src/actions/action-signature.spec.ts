import { createHmac } from "node:crypto";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  signRequest,
  signedPayload,
} from "./action-signature";

const SECRET = "0DkY6qKcqz3ThQ1lQ1yQmSTQ0Fq0MHQ9Q8oXwq3M2mA";
const REQUEST = {
  secret: SECRET,
  timestamp: 1787059200,
  method: "POST",
  url: "https://api.acme.test/repanel/users/u_1/resend-invite",
};

describe("signRequest", () => {
  /**
   * Computed here from the scheme rather than from the implementation: a spec
   * that reuses the code it is checking proves the code agrees with itself.
   */
  it("matches an HMAC computed independently of the signer", () => {
    const expected = createHmac("sha256", SECRET)
      .update(`1787059200.POST https://api.acme.test/repanel/users/u_1/resend-invite`)
      .digest("hex");

    expect(signRequest(REQUEST)[SIGNATURE_HEADER]).toBe(`v1=${expected}`);
  });

  it("sends the timestamp it signed, in unix seconds", () => {
    expect(signRequest(REQUEST)[TIMESTAMP_HEADER]).toBe("1787059200");
  });

  it("names the version, so a second scheme can arrive beside this one", () => {
    expect(signRequest(REQUEST)[SIGNATURE_HEADER]).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it("signs the timestamp, so editing it in flight invalidates the proof", () => {
    const later = signRequest({ ...REQUEST, timestamp: REQUEST.timestamp + 1 });

    expect(later[SIGNATURE_HEADER]).not.toBe(signRequest(REQUEST)[SIGNATURE_HEADER]);
  });

  it.each([
    ["the method", { method: "DELETE" }],
    ["the url", { url: "https://api.acme.test/repanel/users/u_2/resend-invite" }],
    ["the secret", { secret: `${SECRET}x` }],
  ])("signs %s too", (_part, difference) => {
    expect(signRequest({ ...REQUEST, ...difference })[SIGNATURE_HEADER]).not.toBe(
      signRequest(REQUEST)[SIGNATURE_HEADER],
    );
  });

  it("signs the request line and nothing else", () => {
    expect(signedPayload(REQUEST)).toBe(
      "1787059200.POST https://api.acme.test/repanel/users/u_1/resend-invite",
    );
  });
});
