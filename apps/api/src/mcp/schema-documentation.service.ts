import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";

/** The published schema documentation, owned by the contracts package. */
const DOCUMENTATION = "@repanel/contracts/SCHEMA.md";

/**
 * Serves the definition schema documentation to authoring agents. It is read
 * from contracts rather than copied, so what an agent is told and what the
 * validator enforces cannot drift apart.
 */
@Injectable()
export class SchemaDocumentationService {
  /** The document does not change while the process runs, so it is read once. */
  private documentation?: Promise<string>;

  read(): Promise<string> {
    this.documentation ??= readFile(require.resolve(DOCUMENTATION), "utf8");
    return this.documentation;
  }
}
