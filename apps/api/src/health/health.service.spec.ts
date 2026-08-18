import { Test } from "@nestjs/testing";
import { DbService } from "../db/db.service";
import { HealthService } from "./health.service";

describe("HealthService", () => {
  async function serviceWith(execute: jest.Mock): Promise<HealthService> {
    const moduleRef = await Test.createTestingModule({
      providers: [HealthService, { provide: DbService, useValue: { db: { execute } } }],
    }).compile();
    return moduleRef.get(HealthService);
  }

  it("reports the database up when it answers", async () => {
    const service = await serviceWith(jest.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }));

    await expect(service.check()).resolves.toEqual({ status: "ok", db: "up" });
  });

  it("reports the database down rather than failing when the query throws", async () => {
    const service = await serviceWith(jest.fn().mockRejectedValue(new Error("connection refused")));

    await expect(service.check()).resolves.toEqual({ status: "ok", db: "down" });
  });
});
