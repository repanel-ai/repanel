import type { z } from "zod";
import { formatList, formatPath, ROOT_PATH, type ValidationError } from "./errors.js";
import { definitionSchema, SCHEMA_VERSION } from "./schema.js";

type ZodIssue = z.core.$ZodIssue;

/**
 * Turns the zod parse failure into RePanel's error shape. Raw zod issues never
 * reach a caller: they name zod concepts, not definition concepts.
 *
 * The original input is needed because a zod issue does not carry the value it
 * rejected — and telling a missing key apart from a wrong-typed one is the
 * difference between "add this" and "change this".
 */
export function translateZodIssues(issues: readonly ZodIssue[], input: unknown): ValidationError[] {
  return issues.flatMap((issue) => translateIssue(issue, input));
}

function translateIssue(issue: ZodIssue, input: unknown): ValidationError[] {
  const path = formatPath(issue.path);
  const value = valueAt(input, issue.path);

  switch (issue.code) {
    case "unrecognized_keys":
      return issue.keys.map((key) => unrecognizedKey(issue.path, key));

    case "invalid_type":
      return [
        value === undefined
          ? missingKey(issue.path, withArticle(issue.expected))
          : {
              path,
              message: `Expected ${withArticle(issue.expected)}, received ${withArticle(typeName(value))}.`,
              expected: withArticle(issue.expected),
              hint:
                path === ROOT_PATH
                  ? `The definition must be a JSON object with the keys: ${formatList(Object.keys(definitionSchema.shape))}.`
                  : `Change \`${path}\` to ${withArticle(issue.expected)}.`,
            },
      ];

    case "invalid_value":
      return [
        value === undefined
          ? missingKey(issue.path, describeOptions(issue.values))
          : badValue(issue.path, issue.values, value),
      ];

    case "invalid_union":
      return [translateUnion(issue, path, value)];

    case "too_small":
      return [translateTooSmall(issue, path)];

    case "invalid_format":
      // Format messages in this package are written as noun phrases so they
      // compose into both `expected` and `hint`.
      return [
        {
          path,
          message: `\`${describeValue(value)}\` is not a valid value for \`${lastSegment(issue.path)}\`.`,
          expected: issue.message,
          hint: `Change \`${path}\` to ${issue.message}.`,
        },
      ];

    default:
      return [
        {
          path,
          message: issue.message,
          expected: `a value allowed by definition schema ${SCHEMA_VERSION}`,
          hint: `Fix \`${path}\`: ${issue.message}`,
        },
      ];
  }
}

function unrecognizedKey(segments: readonly PropertyKey[], key: string): ValidationError {
  const owner = formatPath(segments);
  return {
    path: formatPath([...segments, key]),
    message: `Unrecognized key \`${key}\`.`,
    expected: `only the keys defined by definition schema ${SCHEMA_VERSION}`,
    hint: `Remove \`${key}\` from \`${owner}\`; schema ${SCHEMA_VERSION} does not define it.`,
  };
}

function missingKey(segments: readonly PropertyKey[], expected: string): ValidationError {
  const key = lastSegment(segments);
  const owner = formatPath(segments.slice(0, -1));
  return {
    path: formatPath(segments),
    message: `Required key \`${key}\` is missing.`,
    expected,
    hint: `Add \`${key}\` to \`${owner}\`; it must be ${expected}.`,
  };
}

function badValue(segments: readonly PropertyKey[], values: readonly unknown[], value: unknown): ValidationError {
  const path = formatPath(segments);
  return {
    path,
    message: `\`${describeValue(value)}\` is not a valid value for \`${lastSegment(segments)}\`.`,
    expected: describeOptions(values),
    hint: `Change \`${path}\` to ${describeOptions(values)}.`,
  };
}

function translateUnion(issue: ZodIssue & { code: "invalid_union" }, path: string, value: unknown): ValidationError {
  const discriminated = discriminatorInfo(issue);
  if (discriminated) {
    // zod points the issue at the discriminator itself, which is exactly where
    // the fix goes.
    return value === undefined
      ? missingKey(issue.path, describeOptions(discriminated.options))
      : badValue(issue.path, discriminated.options, value);
  }

  const allowed = [
    ...new Set(
      issue.errors
        .flat()
        .map((nested) => (nested.code === "invalid_type" ? nested.expected : undefined))
        .filter((expected): expected is string => expected !== undefined),
    ),
  ];
  return {
    path,
    message: `Received ${withArticle(typeName(value))}, which does not match any allowed type.`,
    expected: allowed.length > 0 ? `one of: ${formatList(allowed)}` : issue.message,
    hint:
      allowed.length > 0
        ? `Change \`${path}\` to one of: ${formatList(allowed)}.`
        : `Fix \`${path}\`: ${issue.message}`,
  };
}

function translateTooSmall(issue: ZodIssue & { code: "too_small" }, path: string): ValidationError {
  const key = lastSegment(issue.path);
  const minimum = Number(issue.minimum);
  if (issue.origin === "array") {
    const items = `${minimum} ${minimum === 1 ? "item" : "items"}`;
    return {
      path,
      message: `\`${key}\` must contain at least ${items}.`,
      expected: `an array with at least ${items}`,
      hint: `Add at least ${items} to \`${path}\`.`,
    };
  }
  if (issue.origin === "string") {
    return {
      path,
      message: `\`${key}\` must not be empty.`,
      expected: "a non-empty string",
      hint: `Give \`${path}\` a non-empty value.`,
    };
  }
  return {
    path,
    message: issue.message,
    expected: `at least ${minimum}`,
    hint: `Raise \`${path}\` to at least ${minimum}.`,
  };
}

/**
 * A discriminated-union failure carries the discriminator and its options at
 * runtime; the published issue type does not declare them.
 */
function discriminatorInfo(issue: object): { discriminator: string; options: readonly unknown[] } | undefined {
  const candidate = issue as { discriminator?: unknown; options?: unknown };
  if (typeof candidate.discriminator !== "string" || !Array.isArray(candidate.options)) return undefined;
  return { discriminator: candidate.discriminator, options: candidate.options };
}

function valueAt(input: unknown, segments: readonly PropertyKey[]): unknown {
  let current: unknown = input;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current;
}

function lastSegment(segments: readonly PropertyKey[]): string {
  return String(segments[segments.length - 1] ?? ROOT_PATH);
}

function describeOptions(values: readonly unknown[]): string {
  return values.length === 1 ? `\`${formatList(values)}\`` : `one of: ${formatList(values)}`;
}

function describeValue(value: unknown): string {
  if (typeof value === "string") return value.length > 40 ? `${value.slice(0, 40)}…` : value;
  if (value === null || typeof value !== "object") return String(value);
  return Array.isArray(value) ? "array" : "object";
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function withArticle(name: string): string {
  if (name === "null" || name === "undefined") return name;
  return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`;
}
