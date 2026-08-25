/**
 * The RePanel engine: everything that turns a validated definition into
 * statements against a customer's database, and back into records.
 *
 * It is given what it needs — a definition, a way to reach a database, a secret
 * to sign with — and looks nothing up for itself. There is no framework here,
 * no environment, no control-plane database and no HTTP server: a host supplies
 * the values and decides what a failure becomes on the wire.
 */
export {
  ActionFailedError,
  ConflictError,
  DomainError,
  InvalidQueryError,
  NotFoundError,
  QueryTimeoutError,
  UnservableResourceError,
  ValidationFailedError,
  WriteRefusedError,
  type ActionFailureCode,
} from "./errors.js";

export { indexResources, requireResource } from "./resources.js";

export { CustomerPool, type CustomerPoolOptions } from "./pool/customer-pool.js";

export { QueryBuilder, type Query, type RecordsQuery, type Ownership } from "./query/query-builder.js";

export { RecordReader, type ReadContext } from "./read/record-reader.js";

export { RecordWriter } from "./write/record-writer.js";
export { WRITE_REFUSED, type Assignment } from "./query/write-statements.js";

export { ActionRunner, type ActionContext } from "./actions/action-runner.js";
export { HttpCall, type OutboundCall } from "./actions/http-call.js";
