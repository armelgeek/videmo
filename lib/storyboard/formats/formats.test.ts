import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILT_IN_FORMATS,
  DEFAULT_FORMAT_ID,
  builtInFormat,
  isBuiltInFormat,
} from "./built-in";

describe("shipped video formats", () => {
  it("has unique keys", () => {
    const ids = BUILT_IN_FORMATS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the keys already stored in existing projects", () => {
    expect(isBuiltInFormat("brief")).toBe(true);
    expect(isBuiltInFormat("explainer")).toBe(true);
  });

  it("keeps the paragraph targets the old code used", () => {
    expect(builtInFormat("brief").script.paragraphs).toBe(6);
    expect(builtInFormat("explainer").script.paragraphs).toBe(10);
  });

  it("falls back to the default for an unknown key", () => {
    // A project saved against a format that was later removed must still open.
    expect(builtInFormat("removed-format").id).toBe(DEFAULT_FORMAT_ID);
    expect(builtInFormat(undefined).id).toBe(DEFAULT_FORMAT_ID);
  });

  it("has a recurring character only where the format tells a story", () => {
    expect(BUILT_IN_FORMATS.filter((f) => f.usesCharacter).map((f) => f.id)).toEqual(["story"]);
  });

  it("never points at a thumbnail that does not exist", () => {
    // The first version referenced seven /formats/*.webp images that were never
    // created and stored them in the database. A path is fine; a dead one is not.
    const dead = BUILT_IN_FORMATS.filter(
      (f) => f.thumbnailUrl && !existsSync(join(process.cwd(), "public", f.thumbnailUrl)),
    );
    expect(dead.map((f) => f.id)).toEqual([]);
  });

  it("gives every format a structure and breakdown rules to work from", () => {
    // Without them a format only changes the script's LENGTH: every type of
    // video came out reading the same way.
    for (const f of BUILT_IN_FORMATS) {
      expect(f.script.structure.length).toBeGreaterThan(0);
      expect(f.breakdown.rules.length).toBeGreaterThan(0);
    }
  });

  it("is seedable: every format carries the columns the table requires", () => {
    for (const f of BUILT_IN_FORMATS) {
      expect(f.id).toBeTruthy();
      expect(f.label).toBeTruthy();
      expect(f.hint).toBeTruthy();
      expect(f.script.defaultTone).toBeTruthy();
    }
  });
});
