import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createHmac, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import {
  AirlinesRepository,
  type AirlineApproval,
  type ApprovalStatus,
} from "../airlines/airlines.repository";
import { AppModule } from "../app.module";
import { TEST_ACTION_SECRET } from "../test-env";
import { TOLERANCE_SECONDS } from "./repanel-signature";

/** The secret both sides hold. In production it comes from the RePanel console. */
const SECRET = TEST_ACTION_SECRET;

/**
 * The `airlines` table without a database. The endpoint's rule is the subject
 * here, so the test carries the two rows it needs rather than a container: what
 * is being proven is that a pending airline is approved, a non-pending one is
 * refused, and an unsigned request never reaches either.
 */
class InMemoryAirlines implements Pick<AirlinesRepository, "approveIfPending" | "findApproval"> {
  private readonly rows = new Map<string, ApprovalStatus>();

  add(approvalStatus: ApprovalStatus): string {
    const id = randomUUID();
    this.rows.set(id, approvalStatus);
    return id;
  }

  statusOf(id: string): ApprovalStatus | undefined {
    return this.rows.get(id);
  }

  approveIfPending(id: string): Promise<AirlineApproval | undefined> {
    if (this.rows.get(id) !== "pending") return Promise.resolve(undefined);
    this.rows.set(id, "approved");
    return Promise.resolve({ id, approvalStatus: "approved" });
  }

  findApproval(id: string): Promise<AirlineApproval | undefined> {
    const approvalStatus = this.rows.get(id);
    return Promise.resolve(approvalStatus ? { id, approvalStatus } : undefined);
  }
}

/** The headers docs/SIGNING.md says RePanel sends, produced the way it produces them. */
function sign(url: string, options: { secret?: string; at?: number } = {}): HeadersInit {
  const timestamp = options.at ?? Math.floor(Date.now() / 1000);
  const digest = createHmac("sha256", options.secret ?? SECRET)
    .update(`${timestamp}.POST ${url}`)
    .digest("hex");

  return { "Repanel-Timestamp": String(timestamp), "Repanel-Signature": `v1=${digest}` };
}

describe("POST /repanel/airlines/:id/approve", () => {
  const airlines = new InMemoryAirlines();
  let app: INestApplication;
  let origin: string;

  const approve = (id: string, headers: HeadersInit): Promise<Response> => {
    const url = `${origin}/repanel/airlines/${id}/approve`;
    return fetch(url, { method: "POST", headers });
  };

  /** The URL as it will be requested, which is the URL that has to be signed. */
  const urlOf = (id: string): string => `${origin}/repanel/airlines/${id}/approve`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AirlinesRepository)
      .useValue(airlines)
      .compile();

    app = moduleRef.createNestApplication();
    await app.listen(0, "127.0.0.1");
    const { port } = app.getHttpServer().address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it("approves a pending airline for a request RePanel signed", async () => {
    const id = airlines.add("pending");

    const response = await approve(id, sign(urlOf(id)));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id, approvalStatus: "approved" });
    expect(airlines.statusOf(id)).toBe("approved");
  });

  it("refuses an airline that is not pending, and leaves it alone", async () => {
    const id = airlines.add("rejected");

    const response = await approve(id, sign(urlOf(id)));

    expect(response.status).toBe(409);
    expect(airlines.statusOf(id)).toBe("rejected");
  });

  it("answers for an airline that does not exist without inventing one", async () => {
    const unknown = randomUUID();

    const response = await approve(unknown, sign(urlOf(unknown)));

    expect(response.status).toBe(404);
  });

  it("refuses a request signed with the wrong secret", async () => {
    const id = airlines.add("pending");

    const response = await approve(id, sign(urlOf(id), { secret: `${SECRET}x` }));

    expect(response.status).toBe(401);
    expect(airlines.statusOf(id)).toBe("pending");
  });

  it("refuses a request carrying no signature at all", async () => {
    const id = airlines.add("pending");

    const response = await approve(id, {});

    expect(response.status).toBe(401);
    expect(airlines.statusOf(id)).toBe("pending");
  });

  /** A signature is valid forever; the timestamp is what stops a replay. */
  it("refuses a perfectly good signature that is too old to still be meant", async () => {
    const id = airlines.add("pending");
    const at = Math.floor(Date.now() / 1000) - TOLERANCE_SECONDS - 1;

    const response = await approve(id, sign(urlOf(id), { at }));

    expect(response.status).toBe(401);
    expect(airlines.statusOf(id)).toBe("pending");
  });
});
