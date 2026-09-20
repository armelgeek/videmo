import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FORMAT_ID, getFormat, isKnownFormat, listFormats } from "./index";

describe("video format registry", () => {
  it("has unique ids", () => {
    const ids = listFormats().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the ids already stored in existing projects", () => {
    expect(isKnownFormat("brief")).toBe(true);
    expect(isKnownFormat("explainer")).toBe(true);
  });

  it("keeps the paragraph targets the old code used", () => {
    expect(getFormat("brief").script.paragraphs).toBe(6);
    expect(getFormat("explainer").script.paragraphs).toBe(10);
  });

  it("falls back to the default format for an unknown id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getFormat("removed-format").id).toBe(DEFAULT_FORMAT_ID);
    expect(getFormat(undefined).id).toBe(DEFAULT_FORMAT_ID);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("gives story formats a character and explainer formats none", () => {
    for (const f of listFormats()) {
      if (f.family === "story") expect(f.character).toBeDefined();
      else expect(f.character).toBeUndefined();
    }
  });
});
