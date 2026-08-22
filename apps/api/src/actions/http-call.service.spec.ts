import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { ActionFailedError } from "../errors/domain-errors";
import { signRequest } from "./action-signature";
import { CALL_TIMEOUT_MS, HttpCallService } from "./http-call.service";

const SECRET = "0DkY6qKcqz3ThQ1lQ1yQmSTQ0Fq0MHQ9Q8oXwq3M2mA";

/** What the customer's application would have said, and must never pass on. */
const PRIVATE_BODY = JSON.stringify({ customer: "ada@northwind.io", balance: 4210 });

/** Stands in for a customer's application: answers whatever a test scripted. */
/** Every byte each request carried, so "no body" can be asserted rather than assumed. */
const bodies = new WeakMap<IncomingMessage, string>();

class FakeApplication {
  readonly received: IncomingMessage[] = [];
  answer: (request: IncomingMessage) => { status: number; headers?: Record<string, string> } = () => ({
    status: 200,
  });

  private readonly server: Server;
  private port = 0;

  constructor() {
    this.server = createServer((request, response) => {
      this.received.push(request);
      let body = "";
      request.on("data", (chunk: Buffer) => {
        body += chunk.toString("utf8");
      });
      request.on("end", () => {
        bodies.set(request, body);
        const { status, headers } = this.answer(request);
        response.writeHead(status, { "content-type": "application/json", ...headers });
        response.end(PRIVATE_BODY);
      });
    });
  }

  listen(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(0, "127.0.0.1", () => {
        this.port = (this.server.address() as AddressInfo).port;
        resolve();
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }

  url(path = "/repanel/users/u_1/resend-invite"): string {
    return `http://127.0.0.1:${this.port}${path}`;
  }

  /** A port with nothing listening on it, for the unreachable case. */
  closedUrl(): string {
    return `http://127.0.0.1:${this.port + 1}/repanel/nothing`;
  }
}

/** The error a call was refused with; fails the test if it was not refused. */
async function refusalFrom(call: Promise<unknown>): Promise<ActionFailedError> {
  try {
    await call;
  } catch (error) {
    return error as ActionFailedError;
  }
  throw new Error("expected the call to be refused");
}

describe("HttpCallService", () => {
  let application: FakeApplication;
  let http: HttpCallService;

  beforeEach(async () => {
    application = new FakeApplication();
    await application.listen();
    http = new HttpCallService();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await application.close();
  });

  it("signs the request it actually sends", async () => {
    const url = application.url();

    await http.send({ method: "POST", url, secret: SECRET });

    const sent = application.received[0];
    expect(sent?.method).toBe("POST");
    const timestamp = Number(sent?.headers["repanel-timestamp"]);
    expect(timestamp).toBeGreaterThan(1_700_000_000);
    // The header the application received must verify against the URL it was
    // received at, which is the whole of what the scheme promises.
    expect(sent?.headers["repanel-signature"]).toBe(
      signRequest({ secret: SECRET, timestamp, method: "POST", url })["Repanel-Signature"],
    );
  });

  it("stamps the timestamp in unix seconds, now", async () => {
    await http.send({ method: "POST", url: application.url(), secret: SECRET });

    const stamped = Number(application.received[0]?.headers["repanel-timestamp"]);
    expect(Math.abs(stamped - Math.floor(Date.now() / 1000))).toBeLessThanOrEqual(2);
  });

  it("sends no body, because a v0 action has no inputs", async () => {
    await http.send({ method: "POST", url: application.url(), secret: SECRET });

    const sent = application.received[0];
    expect(sent?.headers["content-length"]).toBe("0");
    expect(sent?.headers["transfer-encoding"]).toBeUndefined();
    expect(bodies.get(sent as IncomingMessage)).toBe("");
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "GET"] as const)("uses the %s the definition names", async (method) => {
    await http.send({ method, url: application.url(), secret: SECRET });

    expect(application.received[0]?.method).toBe(method);
  });

  it("treats any 2xx as success", async () => {
    application.answer = () => ({ status: 204 });

    await expect(http.send({ method: "POST", url: application.url(), secret: SECRET })).resolves.toBeUndefined();
  });

  describe("when the application does not accept it", () => {
    it("reports a rejection with the status and nothing else", async () => {
      application.answer = () => ({ status: 422 });

      const refusal = await refusalFrom(http.send({ method: "POST", url: application.url(), secret: SECRET }));

      expect(refusal).toBeInstanceOf(ActionFailedError);
      expect(refusal.code).toBe("action_rejected");
      expect(refusal.message).toBe("The application answered 422, so the action did not report success.");
    });

    /**
     * The body is the customer's own data on its way into an operator's
     * browser, and RePanel has no idea what is in it.
     */
    it("never carries the application's answer out with it", async () => {
      application.answer = () => ({ status: 500 });

      const refusal = await refusalFrom(http.send({ method: "POST", url: application.url(), secret: SECRET }));

      expect(refusal.message).not.toContain("ada@northwind.io");
      expect(JSON.stringify(refusal)).not.toContain("4210");
    });

    /**
     * The signature covers the address the definition named, so a hop would
     * arrive somewhere else carrying proof for somewhere else.
     */
    it("does not follow a redirect, and does not send the proof twice", async () => {
      application.answer = () => ({ status: 302, headers: { location: "/repanel/elsewhere" } });

      const refusal = await refusalFrom(http.send({ method: "POST", url: application.url(), secret: SECRET }));

      expect(refusal.code).toBe("action_rejected");
      expect(application.received).toHaveLength(1);
    });
  });

  it("reports an application it could not reach", async () => {
    const refusal = await refusalFrom(
      http.send({ method: "POST", url: application.closedUrl(), secret: SECRET }),
    );

    expect(refusal.code).toBe("action_unreachable");
    expect(refusal.message).toBe("The application could not be reached.");
  });

  describe("when the application does not answer", () => {
    /**
     * The real abort, shortened. Only the duration is stubbed: what the service
     * has to categorize is whatever `fetch` rejects with when its signal fires,
     * and that is worth finding out from `fetch` rather than from a mock.
     */
    it("gives up after the time it allowed, and says so", async () => {
      const asked: number[] = [];
      const real = AbortSignal.timeout.bind(AbortSignal);
      jest.spyOn(AbortSignal, "timeout").mockImplementation((ms: number) => {
        asked.push(ms);
        return real(25);
      });
      // A request that is accepted and then left hanging.
      const silent = createServer(() => undefined);
      await new Promise<void>((resolve) => silent.listen(0, "127.0.0.1", () => resolve()));
      const port = (silent.address() as AddressInfo).port;

      const refusal = await refusalFrom(
        http.send({ method: "POST", url: `http://127.0.0.1:${port}/repanel/slow`, secret: SECRET }),
      );

      expect(asked).toEqual([CALL_TIMEOUT_MS]);
      expect(refusal.code).toBe("action_timeout");
      expect(refusal.message).toBe("The application did not answer within 10 seconds.");
      await new Promise<void>((resolve) => silent.close(() => resolve()));
    });
  });
});
