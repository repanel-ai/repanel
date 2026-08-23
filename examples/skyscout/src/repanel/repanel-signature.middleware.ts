import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ConfigService } from "../config/config.service";
import {
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  verifyRepanelRequest,
} from "./repanel-signature";

/**
 * Stands in front of every route in the admin API and nothing else.
 *
 * The URL is rebuilt rather than taken from the router, because what was signed
 * is the address RePanel requested — scheme, host, path and query. Behind a
 * proxy that terminates TLS or rewrites a prefix, read the forwarded scheme and
 * host instead (`app.set("trust proxy", …)`); this is the one place the scheme
 * goes wrong in practice.
 */
@Injectable()
export class RepanelSignatureMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(request: Request, _response: Response, next: NextFunction): void {
    const verified = verifyRepanelRequest({
      secret: this.config.repanelActionSecret,
      method: request.method,
      url: `${request.protocol}://${request.get("host") ?? ""}${request.originalUrl}`,
      timestamp: request.get(TIMESTAMP_HEADER),
      signature: request.get(SIGNATURE_HEADER),
    });

    // Nothing about which half failed: an attacker learning that the timestamp
    // was fine but the digest was not is an attacker being helped.
    if (!verified) throw new UnauthorizedException("Bad signature.");

    next();
  }
}
