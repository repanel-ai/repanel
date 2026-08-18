import { SchemaDocumentationService } from "./schema-documentation.service";

describe("SchemaDocumentationService", () => {
  const service = new SchemaDocumentationService();

  it("serves the schema documentation the contracts package publishes", async () => {
    const documentation = await service.read();

    expect(documentation).toContain("# RePanel definition schema");
    expect(documentation).toContain("## Validation");
    // What an agent is told and what the validator enforces are the same file.
    expect(documentation).toContain("validateDefinition");
  });

  it("reads the document once and serves that read from then on", () => {
    expect(service.read()).toBe(service.read());
  });
});
