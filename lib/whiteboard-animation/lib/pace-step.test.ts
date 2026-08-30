import { describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Animation = require("./Animation");

/** A bare object carrying only what paceStep reads. */
function pacer(frames: number | null) {
  const p = Object.create(Animation.prototype);
  p._frames = frames;
  return p as {
    _frames: number | null;
    paceStep(total: number, legacyStep: number, phases?: number): number;
  };
}

/** Frames actually needed to consume `total` points at this pace. */
function framesToDraw(frames: number, total: number, phases = 1) {
  const p = pacer(frames);
  let drawn = 0;
  let used = 0;
  while (drawn < total && used < frames * 10) {
    drawn += p.paceStep(total, 1, phases);
    used++;
  }
  return used;
}

describe("paceStep", () => {
  it("falls back to the legacy step outside annotation mode", () => {
    expect(pacer(null).paceStep(600, 7)).toBe(7);
  });

  it("spends the whole frame budget instead of finishing early", () => {
    // Real numbers from the reference scene: the title region has 621 stroke
    // points and 232 frames. Rounding up gave 3 points/frame, so it finished in
    // 207 frames — 89% of its window — and froze for the remaining 0.17s.
    expect(framesToDraw(232, 621)).toBe(232);
  });

  it.each([
    [232, 621],
    [493, 844],
    [290, 871],
    [203, 629],
    [286, 552],
  ])("fills the budget for a %i-frame region of %i points", (frames, points) => {
    expect(framesToDraw(frames, points)).toBe(frames);
  });

  it("never returns less than one point per frame", () => {
    const p = pacer(120);
    for (let i = 0; i < 120; i++) expect(p.paceStep(40, 1)).toBeGreaterThanOrEqual(1);
  });

  it("keeps a separate carry per paced list", () => {
    // A style may pace two different lists within one region; sharing the
    // remainder between them would drift both.
    const p = pacer(100);
    const a = Array.from({ length: 100 }, () => p.paceStep(150, 1));
    const b = Array.from({ length: 100 }, () => p.paceStep(250, 1));
    expect(a.reduce((s, n) => s + n, 0)).toBe(150);
    expect(b.reduce((s, n) => s + n, 0)).toBe(250);
  });

  it("splits the budget across a style's phases", () => {
    // With 2 phases each gets half the frames, so each phase paces twice as fast.
    expect(framesToDraw(200, 600, 2)).toBe(100);
  });
});
