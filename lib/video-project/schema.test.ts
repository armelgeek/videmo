import { describe, expect, it } from "vitest";
import { DataUrlRejectedError } from "./errors";
import {
  assertNoDataUrl,
  createVideoProjectSchema,
  updateVideoProjectSchema,
} from "./schema";

describe("createVideoProjectSchema", () => {
  it("accepts a plain title", () => {
    expect(createVideoProjectSchema.parse({ title: "Ma vidéo" })).toEqual({
      title: "Ma vidéo",
    });
  });

  it("rejects an empty title", () => {
    expect(createVideoProjectSchema.safeParse({ title: "" }).success).toBe(false);
  });
});

describe("updateVideoProjectSchema", () => {
  it("accepts a partial patch with only a title", () => {
    const parsed = updateVideoProjectSchema.parse({ title: "Renommé" });
    expect(parsed).toEqual({ title: "Renommé" });
  });

  it("accepts a patch carrying only panels", () => {
    const panels = [
      {
        id: "p1",
        imageUrl: "https://example.test/a.png",
        prompt: "un chat",
        duration: 5,
        isGenerating: false,
      },
    ];
    expect(updateVideoProjectSchema.parse({ panels }).panels).toHaveLength(1);
  });

  it("rejects a malformed panel", () => {
    const result = updateVideoProjectSchema.safeParse({
      panels: [{ id: "p1" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown workflow step", () => {
    expect(updateVideoProjectSchema.safeParse({ step: "editor" }).success).toBe(
      false,
    );
  });
});

describe("assertNoDataUrl", () => {
  it("passes on a document with only http urls", () => {
    expect(() =>
      assertNoDataUrl({ panels: [{ imageUrl: "https://example.test/a.png" }] }),
    ).not.toThrow();
  });

  it("rejects a data: url nested in the whiteboard audio track", () => {
    const document = {
      whiteboardConfig: {
        audio: { name: "voix.mp3", url: "data:audio/mpeg;base64,AAAA" },
      },
    };
    expect(() => assertNoDataUrl(document)).toThrow(DataUrlRejectedError);
  });

  it("names the path of the offending value", () => {
    try {
      assertNoDataUrl({ panels: [{ imageUrl: "data:image/png;base64,AAAA" }] });
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as DataUrlRejectedError).path).toBe("panels.0.imageUrl");
    }
  });

  it("ignores a string that merely mentions data: in the middle", () => {
    expect(() => assertNoDataUrl({ note: "voir data:image plus bas" })).not.toThrow();
  });
});
