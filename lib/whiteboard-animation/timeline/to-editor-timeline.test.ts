import { describe, expect, it } from "vitest";
import type { Annotation } from "@/lib/unified-engine/types";
import { deriveTimeline } from "./derive-timeline";
import { ANNOTATION_TRACK_ID, toEditorTimeline } from "./to-editor-timeline";

function annotation(
  id: string,
  durationMs: number,
  gapBeforeMs?: number,
): Annotation {
  return {
    id,
    text: `Label ${id}`,
    region: { x: 0, y: 0, width: 10, height: 10 },
    reveal: { from: 0, to: 0, startMs: 0, durationMs, gapBeforeMs },
  };
}

const derived = deriveTimeline([
  annotation("a", 1600, 300),
  annotation("b", 3400, 100),
]);

describe("toEditorTimeline", () => {
  it("exposes exactly one track", () => {
    const { tracks } = toEditorTimeline(derived);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].id).toBe(ANNOTATION_TRACK_ID);
    expect(tracks[0].type).toBe("video");
  });

  it("converts milliseconds to seconds", () => {
    const { clips } = toEditorTimeline(derived);
    expect(clips.map((c) => c.start)).toEqual([0.3, 2]);
    expect(clips.map((c) => c.duration)).toEqual([1.6, 3.4]);
  });

  it("maps one annotation to one clip on the single track", () => {
    const { clips } = toEditorTimeline(derived);
    expect(clips).toHaveLength(2);
    expect(clips.map((c) => c.id)).toEqual(["a", "b"]);
    expect(clips.map((c) => c.mediaId)).toEqual(["a", "b"]);
    expect(clips.every((c) => c.trackId === ANNOTATION_TRACK_ID)).toBe(true);
  });

  it("gives every clip a neutral speed and offset", () => {
    const { clips } = toEditorTimeline(derived);
    expect(clips.every((c) => c.speed === 1 && c.offset === 0)).toBe(true);
  });

  it("builds one synthetic media entry per annotation", () => {
    const { mediaMap } = toEditorTimeline(derived);
    expect(Object.keys(mediaMap)).toEqual(["a", "b"]);
    expect(mediaMap.a.type).toBe("image");
    expect(mediaMap.a.status).toBe("ready");
    expect(mediaMap.a.prompt).toBe("Label a");
    expect(mediaMap.a.duration).toBe(1.6);
  });

  it("reports the total duration in seconds", () => {
    expect(toEditorTimeline(derived).durationSeconds).toBe(5.4);
  });

  it("handles an empty timeline without dropping the track", () => {
    const empty = toEditorTimeline(deriveTimeline([]));
    expect(empty.clips).toEqual([]);
    expect(empty.tracks).toHaveLength(1);
    expect(empty.durationSeconds).toBe(0);
  });
});
