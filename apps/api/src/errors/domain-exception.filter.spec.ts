import { ArgumentsHost, HttpStatus, Logger, NotFoundException } from "@nestjs/common";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationFailedError,
} from "./domain-errors";
import { DomainExceptionFilter } from "./domain-exception.filter";

describe("DomainExceptionFilter", () => {
  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  function respondTo(exception: unknown): { status: number; body: unknown } {
    const sent: { status: number; body: unknown } = { status: 0, body: undefined };
    const response = {
      status(code: number) {
        sent.status = code;
        return this;
      },
      json(body: unknown) {
        sent.body = body;
      },
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new DomainExceptionFilter().catch(exception, host);
    return sent;
  }

  it("maps a NotFoundError to 404 with the safe body shape", () => {
    const sent = respondTo(new NotFoundError("Project does not exist"));

    expect(sent.status).toBe(HttpStatus.NOT_FOUND);
    expect(sent.body).toEqual({ error: { code: "not_found", message: "Project does not exist" } });
  });

  it.each<[DomainError, number, string]>([
    [new UnauthorizedError("Sign in to continue"), HttpStatus.UNAUTHORIZED, "unauthorized"],
    [new ForbiddenError("Not your project"), HttpStatus.FORBIDDEN, "forbidden"],
    [new ConflictError("Email already registered"), HttpStatus.CONFLICT, "conflict"],
  ])("maps %s to its status", (error, status, code) => {
    const sent = respondTo(error);

    expect(sent.status).toBe(status);
    expect(sent.body).toEqual({ error: { code, message: error.message } });
  });

  it("carries validation details through unchanged", () => {
    const details = [
      { path: "resources[0].key", message: "Not a usable key", expected: "a snake_case identifier", hint: "Rename it to `user_accounts`." },
    ];

    const sent = respondTo(new ValidationFailedError("Definition is invalid", details));

    expect(sent.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    expect(sent.body).toEqual({
      error: { code: "validation_failed", message: "Definition is invalid", details },
    });
  });

  it("keeps the status of a framework HttpException instead of masking it", () => {
    const sent = respondTo(new NotFoundException("Cannot GET /nope"));

    expect(sent.status).toBe(HttpStatus.NOT_FOUND);
    expect(sent.body).toEqual({ error: { code: "not_found", message: "Cannot GET /nope" } });
  });

  it("hides an unknown error behind a generic 500 and logs it server-side", () => {
    const sent = respondTo(new Error("password authentication failed for user \"repanel\""));

    expect(sent.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(sent.body).toEqual({
      error: { code: "internal_error", message: "Internal server error" },
    });
    expect(JSON.stringify(sent.body)).not.toContain("password");
    expect(logged).toHaveBeenCalled();
  });
});
