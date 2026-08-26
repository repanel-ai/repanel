import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One authorization idiom, and only one.
 *
 * `requireOwned` and `requireOwnedByKey` were the whole of the model before
 * roles existed (THREAT-MODEL §8.2). They are gone, and this is what keeps them
 * gone: two idioms living side by side is how a route ends up asking the
 * question that has the wrong answer, and a rename is exactly the kind of change
 * that leaves one behind in a corner nobody greps.
 *
 * The gate reads the source tree rather than this package's imports, because a
 * leftover in the console or the CLI is the same defect wearing a different hat.
 */

const RETIRED = ["requireOwned", "requireOwnedByKey"];

/** Where this repository keeps code. Everything else is somebody else's. */
const ROOTS = ["apps/api/src", "apps/web/src", "apps/runtime/src", "packages/cli/src"];

const REPOSITORY = join(__dirname, "..", "..", "..", "..");

function sourceFiles(root: string): string[] {
  return readdirSync(join(REPOSITORY, root), { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .map((file) => join(root, file));
}

/** Every line that names one of the retired methods, with where it is. */
function mentions(name: string): string[] {
  return ROOTS.flatMap(sourceFiles)
    .filter((file) => !file.endsWith("authorization-idiom.spec.ts"))
    .flatMap((file) =>
      readFileSync(join(REPOSITORY, file), "utf8")
        .split("\n")
        .flatMap((line, index) =>
          new RegExp(`\\b${name}\\b`).test(line) ? [`${file}:${index + 1}`] : [],
        ),
    );
}

describe("the one authorization idiom", () => {
  it.each(RETIRED)("has retired %s completely", (name) => {
    expect(mentions(name)).toEqual([]);
  });

  it("still reads the source tree it is meant to be guarding", () => {
    // The gate is only worth having if it would have found something: this is
    // the case that fails if the roots above stop naming real directories.
    expect(mentions("requireMember").length).toBeGreaterThan(0);
  });
});
