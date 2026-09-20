import { describe, expect, it } from "vitest";

const { resoudreTransition, nomsTransitions } = require("./transitions");

const W = 1000;
const H = 500;
const OUTGOING = { name: "outgoing" } as never;
const INCOMING = { name: "incoming" } as never;

/** Spy context: records draw calls instead of painting them. */
function spyCtx() {
  const calls: { img: string; x: number; y: number; alpha: number }[] = [];
  let alpha = 1;
  return {
    calls,
    get globalAlpha() { return alpha; },
    set globalAlpha(v: number) { alpha = v; },
    save() {},
    restore() { alpha = 1; },
    drawImage(img: { name: string }, x: number, y: number) {
      // `|| 0` turns NEGATIVE zero into zero: at t = 0, -Math.round(H * 0)
      // is -0, which toEqual distinguishes from 0 although rendering is identical.
      calls.push({ img: img.name, x: x || 0, y: y || 0, alpha });
    },
  };
}

const play = (name: string, t: number) => {
  const fn = resoudreTransition(name);
  const ctx = spyCtx();
  fn(ctx, OUTGOING, INCOMING, t, W, H);
  return ctx.calls;
};

describe("resoudreTransition", () => {
  it("exposes the six expected transitions", () => {
    expect(nomsTransitions().sort()).toEqual(
      ["cut", "fade", "slidedown", "slideleft", "slideright", "slideup"].sort(),
    );
  });

  it("returns null for 'none' and for a missing name", () => {
    expect(resoudreTransition("none")).toBeNull();
    expect(resoudreTransition("")).toBeNull();
    expect(resoudreTransition(undefined)).toBeNull();
  });

  it("falls back to fade for an unknown name", () => {
    expect(resoudreTransition("explode")).toBe(resoudreTransition("fade"));
  });

  it("normalizes case and spaces", () => {
    expect(resoudreTransition("Slide Up")).toBe(resoudreTransition("slideup"));
  });
});

describe("cut", () => {
  it("shows the outgoing before halfway, the incoming after", () => {
    expect(play("cut", 0.2)).toEqual([{ img: "outgoing", x: 0, y: 0, alpha: 1 }]);
    expect(play("cut", 0.8)).toEqual([{ img: "incoming", x: 0, y: 0, alpha: 1 }]);
  });
});

describe("fade", () => {
  it("overlays the incoming with opacity equal to t", () => {
    expect(play("fade", 0)).toEqual([
      { img: "outgoing", x: 0, y: 0, alpha: 1 },
      { img: "incoming", x: 0, y: 0, alpha: 0 },
    ]);
    expect(play("fade", 0.5)).toEqual([
      { img: "outgoing", x: 0, y: 0, alpha: 1 },
      { img: "incoming", x: 0, y: 0, alpha: 0.5 },
    ]);
    expect(play("fade", 1)).toEqual([
      { img: "outgoing", x: 0, y: 0, alpha: 1 },
      { img: "incoming", x: 0, y: 0, alpha: 1 },
    ]);
  });
});

describe("slides", () => {
  it("slideup: the outgoing moves up, the incoming follows from below", () => {
    expect(play("slideup", 0.5)).toEqual([
      { img: "outgoing", x: 0, y: -250, alpha: 1 },
      { img: "incoming", x: 0, y: 250, alpha: 1 },
    ]);
  });

  it("slidedown: mirror of the previous one", () => {
    expect(play("slidedown", 0.5)).toEqual([
      { img: "outgoing", x: 0, y: 250, alpha: 1 },
      { img: "incoming", x: 0, y: -250, alpha: 1 },
    ]);
  });

  it("slideleft: horizontal move, not vertical", () => {
    expect(play("slideleft", 0.5)).toEqual([
      { img: "outgoing", x: -500, y: 0, alpha: 1 },
      { img: "incoming", x: 500, y: 0, alpha: 1 },
    ]);
  });

  it("slideright: mirror of the previous one", () => {
    expect(play("slideright", 0.5)).toEqual([
      { img: "outgoing", x: 500, y: 0, alpha: 1 },
      { img: "incoming", x: -500, y: 0, alpha: 1 },
    ]);
  });

  it("starts with the outgoing in place and ends with the incoming in place", () => {
    for (const name of ["slideup", "slidedown", "slideleft", "slideright"]) {
      const start = play(name, 0);
      const end = play(name, 1);
      expect(start[0]).toEqual({ img: "outgoing", x: 0, y: 0, alpha: 1 });
      expect(end[1]).toEqual({ img: "incoming", x: 0, y: 0, alpha: 1 });
    }
  });
});
