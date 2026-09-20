import { describe, expect, it } from "vitest";
import {
  NARRATION_DRIFT_MS,
  narrationEndMs,
  nextNarrationAction,
  partAt,
  scheduleParts,
} from "./narration-schedule";

const parts = [
  { url: "/0.mp3", startMs: 0, durationMs: 1000 },
  { url: "/1.mp3", startMs: 1000, durationMs: 2000 },
];

describe("partAt", () => {
  it("returns the part covering the instant, and the position within it", () => {
    expect(partAt(parts, 1500)).toEqual({
      index: 1,
      part: parts[1],
      offsetMs: 500,
    });
  });

  it("switches to the next part at the boundary, without replaying the end", () => {
    expect(partAt(parts, 1000)?.index).toBe(1);
    expect(partAt(parts, 999)?.index).toBe(0);
  });

  it("plays nothing after the last part", () => {
    expect(partAt(parts, 3000)).toBeNull();
  });

  it("plays nothing in the gap left by a silent beat", () => {
    const withGap = [
      { url: "/0.mp3", startMs: 0, durationMs: 1000 },
      { url: "/2.mp3", startMs: 3000, durationMs: 1000 },
    ];

    expect(partAt(withGap, 2000)).toBeNull();
    expect(partAt(withGap, 3500)?.index).toBe(1);
  });

  it("plays nothing before the first part", () => {
    expect(partAt([{ url: "/a.mp3", startMs: 500, durationMs: 100 }], 200)).toBeNull();
  });

  it("plays nothing when there are no parts", () => {
    expect(partAt([], 0)).toBeNull();
  });
});

describe("narrationEndMs", () => {
  it("returns the end of the last part", () => {
    expect(narrationEndMs(parts)).toBe(3000);
  });

  it("returns zero without parts", () => {
    expect(narrationEndMs([])).toBe(0);
  });
});

describe("scheduleParts", () => {
  it("lays parts end to end", () => {
    expect(
      scheduleParts([
        { url: "/a.mp3", durationMs: 1100 },
        { url: "/b.mp3", durationMs: 2200 },
      ]),
    ).toEqual([
      { url: "/a.mp3", startMs: 0, durationMs: 1100 },
      { url: "/b.mp3", startMs: 1100, durationMs: 2200 },
    ]);
  });

  it("lets a silent beat advance the cursor without placing anything", () => {
    expect(
      scheduleParts([
        { url: null, durationMs: 2000 },
        { url: "/b.mp3", durationMs: 1000 },
      ]),
    ).toEqual([{ url: "/b.mp3", startMs: 2000, durationMs: 1000 }]);
  });
});

describe("nextNarrationAction", () => {
  it("loads the current part when none is in place", () => {
    expect(nextNarrationAction({ index: null, offsetMs: 0 }, parts, 1500)).toEqual({
      type: "load",
      index: 1,
      part: parts[1],
      offsetMs: 500,
    });
  });

  it("does nothing while the right part tracks its position", () => {
    expect(
      nextNarrationAction({ index: 1, offsetMs: 480 }, parts, 1500),
    ).toEqual({ type: "none" });
  });

  it("resyncs without reloading when the position drifted", () => {
    expect(
      nextNarrationAction({ index: 1, offsetMs: 100 }, parts, 1500),
    ).toEqual({ type: "resync", index: 1, offsetMs: 500 });
  });

  it("changes part at the boundary", () => {
    const action = nextNarrationAction({ index: 0, offsetMs: 990 }, parts, 1010);

    expect(action).toMatchObject({ type: "load", index: 1, offsetMs: 10 });
  });

  it("goes silent in a gap, without needlessly unloading afterwards", () => {
    const withGap = [
      { url: "/0.mp3", startMs: 0, durationMs: 1000 },
      { url: "/2.mp3", startMs: 3000, durationMs: 1000 },
    ];

    expect(nextNarrationAction({ index: 0, offsetMs: 999 }, withGap, 2000)).toEqual({
      type: "silence",
    });
    // Once silent, it does not request silence again every frame.
    expect(nextNarrationAction({ index: null, offsetMs: 0 }, withGap, 2000)).toEqual({
      type: "none",
    });
  });

  it("resyncs as soon as drift exceeds the project threshold", () => {
    // The same threshold as for a single track: beyond about 125 ms, an
    // audio/video offset is noticeable.
    expect(NARRATION_DRIFT_MS).toBe(120);
    expect(
      nextNarrationAction({ index: 1, offsetMs: 500 - 130 }, parts, 1500),
    ).toMatchObject({ type: "resync" });
    expect(
      nextNarrationAction({ index: 1, offsetMs: 500 - 110 }, parts, 1500),
    ).toEqual({ type: "none" });
  });

  it("tolerates a wider drift when asked", () => {
    expect(
      nextNarrationAction({ index: 1, offsetMs: 100 }, parts, 1500, 1000),
    ).toEqual({ type: "none" });
  });
});
