import { describe, expect, it } from "vitest";
import { DEFAULT_WHITEBOARD_CONFIG } from "@/lib/storyboard/store";
import { EphemeralUrlRejectedError } from "./errors";
import {
  assertNoEphemeralUrl,
  whiteboardConfigSchema,
  createVideoProjectSchema,
  updateVideoProjectSchema,
} from "./schema";

describe("createVideoProjectSchema", () => {
  it("accepts a plain title and defaults to landscape", () => {
    expect(createVideoProjectSchema.parse({ title: "Ma vidéo" })).toEqual({
      title: "Ma vidéo",
      aspectRatio: "16:9",
    });
  });

  it("keeps the chosen format and rejects an unknown one", () => {
    expect(createVideoProjectSchema.parse({ title: "Reel", aspectRatio: "9:16" }).aspectRatio).toBe("9:16");
    expect(createVideoProjectSchema.safeParse({ title: "Reel", aspectRatio: "4:3" }).success).toBe(false);
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

describe("whiteboardConfigSchema", () => {
  it("keeps every field of a real DEFAULT_WHITEBOARD_CONFIG", () => {
    const parsed = whiteboardConfigSchema.parse(DEFAULT_WHITEBOARD_CONFIG);
    expect(parsed).toEqual(DEFAULT_WHITEBOARD_CONFIG);
  });

  it("keeps the legacy fields of a saved project", () => {
    const legacy = {
      ...DEFAULT_WHITEBOARD_CONFIG,
      revealSpeed: 2,
      handSpeed: 1.5,
      chunks: 8,
      useAnnotation: true,
    };
    expect(whiteboardConfigSchema.parse(legacy)).toEqual(legacy);
  });

  it("keeps every metadata field of an audio track", () => {
    const audio = {
      id: "a1",
      name: "voix.mp3",
      source: "tts" as const,
      durationMs: 4200,
      volume: 0.8,
      muted: false,
      offsetMs: 250,
      url: "https://example.test/voix.mp3",
    };
    expect(
      whiteboardConfigSchema.parse({ ...DEFAULT_WHITEBOARD_CONFIG, audio }).audio,
    ).toEqual(audio);
  });

  it("drops a blob: audio url instead of storing a dead link", () => {
    const parsed = whiteboardConfigSchema.parse({
      ...DEFAULT_WHITEBOARD_CONFIG,
      audio: { name: "voix.mp3", durationMs: 1000, url: "blob:http://x/abc" },
    });
    expect(parsed.audio?.url).toBeNull();
  });
});

describe("assertNoEphemeralUrl", () => {
  it("passes on a document with only http urls", () => {
    expect(() =>
      assertNoEphemeralUrl({ panels: [{ imageUrl: "https://example.test/a.png" }] }),
    ).not.toThrow();
  });

  it("rejects a data: url nested in the whiteboard audio track", () => {
    const document = {
      whiteboardConfig: {
        audio: { name: "voix.mp3", url: "data:audio/mpeg;base64,AAAA" },
      },
    };
    expect(() => assertNoEphemeralUrl(document)).toThrow(EphemeralUrlRejectedError);
  });

  it("names the path of the offending value", () => {
    try {
      assertNoEphemeralUrl({ panels: [{ imageUrl: "data:image/png;base64,AAAA" }] });
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as EphemeralUrlRejectedError).path).toBe("panels.0.imageUrl");
    }
  });

  it("ignores a string that merely mentions data: in the middle", () => {
    expect(() => assertNoEphemeralUrl({ note: "voir data:image plus bas" })).not.toThrow();
  });

  it("rejects an uppercase DATA: url (RFC 2397 is case-insensitive)", () => {
    expect(() =>
      assertNoEphemeralUrl({ url: "DATA:image/png;base64,AAAA" }),
    ).toThrow(EphemeralUrlRejectedError);
  });

  it("rejects a data: url hidden behind a leading space", () => {
    expect(() =>
      assertNoEphemeralUrl({ url: " data:image/png;base64,AAAA" }),
    ).toThrow(EphemeralUrlRejectedError);
  });

  it("rejects a blob: url, dead outside its tab", () => {
    expect(() =>
      assertNoEphemeralUrl({ url: "blob:http://localhost/9f2" }),
    ).toThrow(EphemeralUrlRejectedError);
  });
});
