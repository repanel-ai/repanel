import { Parameters } from "./parameters.js";

describe("Parameters", () => {
  it("numbers values in the order they are bound", () => {
    const parameters = new Parameters();

    expect(parameters.bind("acme")).toBe("$1");
    expect(parameters.bind(25)).toBe("$2");
    expect(parameters.bind(true)).toBe("$3");
    expect(parameters.values()).toEqual(["acme", 25, true]);
  });

  it("gives back a list nobody else can grow", () => {
    const parameters = new Parameters();
    parameters.bind("acme");

    parameters.values().push("smuggled");

    expect(parameters.values()).toEqual(["acme"]);
  });

  it("binds a hostile string as a value like any other", () => {
    const parameters = new Parameters();

    expect(parameters.bind("'; drop table users; --")).toBe("$1");
    expect(parameters.values()).toEqual(["'; drop table users; --"]);
  });
});
