import { describe, expect, it } from "vitest";
import { slugify } from "./string";

describe("slugify", () => {
  it("lowercases and joins words with hyphens", () => {
    expect(slugify("Mon Equipe Test")).toBe("mon-equipe-test");
  });

  it("transliterates accented letters instead of dropping them", () => {
    expect(slugify("Mon Équipe Test")).toBe("mon-equipe-test");
    expect(slugify("Crème Brûlée")).toBe("creme-brulee");
    expect(slugify("Señor Núñez")).toBe("senor-nunez");
  });

  it("drops punctuation and collapses separators", () => {
    expect(slugify("Acme, Inc.  —  R&D")).toBe("acme-inc-rd");
    expect(slugify("a__b  c")).toBe("a-b-c");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  !Hello!  ")).toBe("hello");
  });

  it("keeps digits", () => {
    expect(slugify("Équipe 2")).toBe("equipe-2");
  });
});
