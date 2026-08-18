import { BadRequestException, type ArgumentMetadata } from "@nestjs/common";
import { z } from "zod";
import { zodDto } from "./zod-dto";
import { ZodValidationPipe } from "./zod-validation.pipe";

class OrderDto extends zodDto(
  z.object({
    reference: z.string().trim().toUpperCase(),
    quantity: z.number().int().positive("must be a positive whole number"),
  }),
) {}

describe("ZodValidationPipe", () => {
  const pipe = new ZodValidationPipe();

  function transform(value: unknown, metatype: ArgumentMetadata["metatype"]): unknown {
    return pipe.transform(value, { type: "body", metatype, data: undefined });
  }

  it("hands on the parsed value, not the raw one", () => {
    expect(transform({ reference: " ab-1 ", quantity: 2 }, OrderDto)).toEqual({
      reference: "AB-1",
      quantity: 2,
    });
  });

  it("names every offending field in one response", () => {
    expect(() => transform({ reference: 1, quantity: -1 }, OrderDto)).toThrow(BadRequestException);
    expect(() => transform({ reference: 1, quantity: -1 }, OrderDto)).toThrow(
      "quantity must be a positive whole number",
    );
  });

  it("rejects a body that is not an object at all", () => {
    expect(() => transform("not a body", OrderDto)).toThrow(BadRequestException);
  });

  it("leaves arguments that carry no schema alone", () => {
    expect(transform("raw", String)).toBe("raw");
    expect(transform({ untouched: true }, undefined)).toEqual({ untouched: true });
  });
});
