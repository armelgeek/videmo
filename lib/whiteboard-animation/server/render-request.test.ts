import { describe, expect, it } from "vitest";
import { resolveExportSize } from "./render-request";

describe("resolveExportSize", () => {
  it("rend du paysage en 16:9", () => {
    expect(resolveExportSize("720p", "16:9")).toEqual({ width: 1280, height: 720 });
    expect(resolveExportSize("1080p", "16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("rend du portrait en 9:16, sans transposer le libelle", () => {
    expect(resolveExportSize("1080p", "9:16")).toEqual({ width: 1080, height: 1920 });
    expect(resolveExportSize("720p", "9:16")).toEqual({ width: 720, height: 1280 });
  });

  it("rend un carre en 1:1", () => {
    expect(resolveExportSize("1080p", "1:1")).toEqual({ width: 1080, height: 1080 });
  });

  it("ne rend que des dimensions paires, exigees par yuv420p", () => {
    for (const q of ["720p", "1080p"] as const) {
      for (const r of ["16:9", "9:16", "1:1"] as const) {
        const { width, height } = resolveExportSize(q, r);
        expect(width % 2).toBe(0);
        expect(height % 2).toBe(0);
      }
    }
  });
});
