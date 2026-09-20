import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("converts spaces and symbols to dashes", () => {
    expect(slugify("My Custom Format")).toBe("my-custom-format");
    expect(slugify("Format & Style (v2)")).toBe("format-style-v2");
  });

  it("removes diacritics and accents", () => {
    expect(slugify("Éducation & Présentation")).toBe("education-presentation");
  });

  it("trims trailing and leading dashes", () => {
    expect(slugify("---test---")).toBe("test");
  });

  it("caps length at 64 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBe(64);
  });
});
