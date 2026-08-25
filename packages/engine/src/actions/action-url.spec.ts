import { validateDefinition, type HttpCallAction, type RecordValue, type Resource } from "@repanel/contracts";
import { saasDefinition } from "@repanel/contracts/fixtures";
import { InvalidQueryError, UnservableResourceError } from "../errors.js";
import { resolveActionUrl } from "./action-url.js";

/** The shared fixture as the API sees it: validated, defaults applied. */
const result = validateDefinition(saasDefinition);
if (!result.valid) throw new Error("the shared definition fixture no longer validates");
const { definition } = result;

function resourceIn(key: string): Resource {
  const resource = definition.resources.find((candidate) => candidate.key === key);
  if (!resource) throw new Error(`the fixture has no resource \`${key}\``);
  return resource;
}

const USERS = resourceIn("users");

/** The fixture's own httpCall action, pointed at whichever template a case is about. */
function callTo(url: string): HttpCallAction {
  return {
    key: "resend_invite",
    label: "Resend invite",
    confirm: "Send the invitation email again?",
    kind: "httpCall",
    method: "POST",
    url,
  };
}

function values(overrides: Record<string, RecordValue> = {}): Record<string, RecordValue> {
  return {
    id: "u_1",
    email: "maya@northwind.io",
    name: "Maya Okonkwo",
    organization_id: { id: "o_1", label: "Northwind Labs" },
    login_count: 1284,
    is_active: true,
    preferences: { theme: "dark" },
    ...overrides,
  };
}

/** The error a call was refused with; fails the test if it was not refused. */
function refusalFrom(call: () => unknown): Error {
  try {
    call();
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected the call to be refused");
}

describe("resolveActionUrl", () => {
  it("fills a placeholder from the record's own value", () => {
    const url = resolveActionUrl(
      USERS,
      callTo("https://api.acme.test/repanel/users/{id}/resend-invite"),
      values(),
    );

    expect(url).toBe("https://api.acme.test/repanel/users/u_1/resend-invite");
  });

  it("fills every placeholder a template carries, including a repeated one", () => {
    const url = resolveActionUrl(
      USERS,
      callTo("https://api.acme.test/repanel/{id}/orgs/{organization_id}/sync?who={id}"),
      values(),
    );

    expect(url).toBe("https://api.acme.test/repanel/u_1/orgs/o_1/sync?who=u_1");
  });

  it("leaves a template with no placeholders exactly as written", () => {
    const url = resolveActionUrl(USERS, callTo("https://api.acme.test/repanel/reindex"), values());

    expect(url).toBe("https://api.acme.test/repanel/reindex");
  });

  it("reads a relation as the key it points at, never as the label a human sees", () => {
    const url = resolveActionUrl(
      USERS,
      callTo("https://api.acme.test/repanel/orgs/{organization_id}/sync"),
      values(),
    );

    expect(url).toBe("https://api.acme.test/repanel/orgs/o_1/sync");
  });

  it("says a number and a boolean the way they are written, not the way they are drawn", () => {
    const url = resolveActionUrl(
      USERS,
      callTo("https://api.acme.test/repanel/{login_count}/{is_active}"),
      values(),
    );

    expect(url).toBe("https://api.acme.test/repanel/1284/true");
  });

  /**
   * The value came out of a customer's database, where a reference is allowed
   * to contain a slash, a question mark or a space. Unencoded, any of the three
   * sends a signed request to a route the definition never named.
   */
  it("encodes a value so it cannot re-point the address", () => {
    const url = resolveActionUrl(
      USERS,
      callTo("https://api.acme.test/repanel/users/{id}/resend-invite"),
      values({ id: "a/../admin?x=1 y" }),
    );

    expect(url).toBe(
      "https://api.acme.test/repanel/users/a%2F..%2Fadmin%3Fx%3D1%20y/resend-invite",
    );
  });

  describe("refuses what it cannot fill", () => {
    /**
     * Validation refuses this outright (`action-checks.ts`), so a definition
     * that gets here with one predates the rule — and a URL reaches access
     * logs, proxies and error trackers (DECISIONS #014).
     */
    it("refuses a sensitive field, which the record never carried anyway", () => {
      const refusal = refusalFrom(() =>
        resolveActionUrl(
          USERS,
          callTo("https://api.acme.test/repanel/{password_hash}"),
          values(),
        ),
      );

      expect(refusal).toBeInstanceOf(UnservableResourceError);
      expect(refusal.message).toContain("password_hash");
      expect(refusal.message).toContain("sensitive");
    });

    it("refuses a placeholder that names no field of the resource", () => {
      const refusal = refusalFrom(() =>
        resolveActionUrl(USERS, callTo("https://api.acme.test/repanel/{tenant}"), values()),
      );

      expect(refusal).toBeInstanceOf(UnservableResourceError);
      expect(refusal.message).toContain("tenant");
    });

    it("refuses a record with nothing to put in the address", () => {
      const refusal = refusalFrom(() =>
        resolveActionUrl(
          USERS,
          callTo("https://api.acme.test/repanel/orgs/{organization_id}/sync"),
          values({ organization_id: { id: null, label: null } }),
        ),
      );

      expect(refusal).toBeInstanceOf(InvalidQueryError);
      expect(refusal.message).toBe(
        "Action `Resend invite` needs a value for `organization_id`, and this user has none.",
      );
    });

    it("refuses a null the same way, rather than sending an empty segment", () => {
      const refusal = refusalFrom(() =>
        resolveActionUrl(USERS, callTo("https://api.acme.test/repanel/{name}"), values({ name: null })),
      );

      expect(refusal).toBeInstanceOf(InvalidQueryError);
    });

    /** A structured value has no single reading, which is why it cannot be a label either. */
    it("refuses a structured value", () => {
      const refusal = refusalFrom(() =>
        resolveActionUrl(USERS, callTo("https://api.acme.test/repanel/{preferences}"), values()),
      );

      expect(refusal).toBeInstanceOf(InvalidQueryError);
    });
  });
});
