import { describe, expect, it } from "vitest";

import { parseNameOnlyLines } from "../src/core/git.js";

describe("parseNameOnlyLines", () => {
  it("parses name-only output", () => {
    expect(parseNameOnlyLines("a.ts\nb.ts\n")).toEqual(["a.ts", "b.ts"]);
  });

  it("drops blank lines and whitespace", () => {
    expect(parseNameOnlyLines("\n  a.ts \n\n b.ts\t\n")).toEqual(["a.ts", "b.ts"]);
  });
});

