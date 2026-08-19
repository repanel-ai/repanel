import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { ValidationError } from "@repanel/contracts";
import type { Response } from "express";
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  UnauthorizedError,
  ValidationFailedError,
} from "./domain-errors";

/** The only error shape a client ever sees. */
interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: readonly ValidationError[];
  };
}

interface Failure {
  status: number;
  body: ErrorBody;
}

/** Turns anything thrown into a safe response; internals are logged, never sent. */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, body } = this.describe(exception);
    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }

  private describe(exception: unknown): Failure {
    if (exception instanceof ValidationFailedError) {
      return failure(HttpStatus.UNPROCESSABLE_ENTITY, exception, exception.details);
    }
    if (exception instanceof DomainError) {
      return failure(statusOf(exception), exception);
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return { status, body: { error: { code: codeForStatus(status), message: exception.message } } };
    }

    this.logger.error(
      "Unhandled exception",
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { error: { code: "internal_error", message: "Internal server error" } },
    };
  }
}

function statusOf(error: DomainError): number {
  if (error instanceof NotFoundError) return HttpStatus.NOT_FOUND;
  if (error instanceof UnauthorizedError) return HttpStatus.UNAUTHORIZED;
  if (error instanceof ForbiddenError) return HttpStatus.FORBIDDEN;
  if (error instanceof ConflictError) return HttpStatus.CONFLICT;
  if (error instanceof InvalidQueryError) return HttpStatus.BAD_REQUEST;
  if (error instanceof QueryTimeoutError) return HttpStatus.GATEWAY_TIMEOUT;
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

/** `404` → `"not_found"`, so framework errors read like domain ones. */
function codeForStatus(status: number): string {
  const name: unknown = HttpStatus[status as HttpStatus];
  return typeof name === "string" ? name.toLowerCase() : "http_error";
}

function failure(
  status: number,
  error: DomainError,
  details?: readonly ValidationError[],
): Failure {
  const body: ErrorBody = { error: { code: error.code, message: error.message } };
  if (details) body.error.details = details;
  return { status, body };
}
