import { describe, expect, it } from "vitest";
import { AnimationFactory } from "@/lib/whiteboard-animation/AnimationFactory";
import { CUSTOM_HANDS } from "@/lib/whiteboard-animation/lib/hands";
import {
  BUILT_IN_WHITEBOARD_STYLES,
  DEFAULT_WHITEBOARD_STYLE_ID,
  builtInWhiteboardStyle,
  isBuiltInWhiteboardStyle,
} from "./built-in";
import { whiteboardStyleInputSchema } from "./schema";

/**
 * The landing once advertised styles the engine did not have, and a visitor who
 * picked one got the default render with no warning. These tie the shipped
 * styles to the engine so that cannot happen here.
 */
describe("shipped whiteboard styles", () => {
  it("only use animations the engine implements", () => {
    const unknown = BUILT_IN_WHITEBOARD_STYLES.filter(
      (s) => !AnimationFactory.isStyleAvailable(s.animStyle),
    );
    expect(unknown.map((s) => s.id)).toEqual([]);
  });

  it("only use hands the engine ships", () => {
    const unknown = BUILT_IN_WHITEBOARD_STYLES.filter((s) => !(s.handStyle in CUSTOM_HANDS));
    expect(unknown.map((s) => s.id)).toEqual([]);
  });

  it("have unique ids", () => {
    const ids = BUILT_IN_WHITEBOARD_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("include the default", () => {
    expect(isBuiltInWhiteboardStyle(DEFAULT_WHITEBOARD_STYLE_ID)).toBe(true);
  });

  it("fall back to the default for an unknown id", () => {
    expect(builtInWhiteboardStyle("removed").id).toBe(DEFAULT_WHITEBOARD_STYLE_ID);
    expect(builtInWhiteboardStyle(undefined).id).toBe(DEFAULT_WHITEBOARD_STYLE_ID);
  });
});

describe("whiteboardStyleInputSchema", () => {
  const valid = {
    key: "my-style",
    label: "Mine",
    hint: "Slow and careful.",
    animStyle: "contour",
    handStyle: "custom2",
  };

  it("accepts a style the engine can render", () => {
    expect(whiteboardStyleInputSchema.safeParse(valid).success).toBe(true);
  });

  it("refuses an animation the engine does not have", () => {
    // This is the whole point: "oil" would have rendered as the default.
    const result = whiteboardStyleInputSchema.safeParse({ ...valid, animStyle: "oil" });
    expect(result.success).toBe(false);
  });

  it("refuses a hand the engine does not have", () => {
    expect(whiteboardStyleInputSchema.safeParse({ ...valid, handStyle: "robot" }).success).toBe(false);
  });

  it("refuses a key that is not a slug", () => {
    expect(whiteboardStyleInputSchema.safeParse({ ...valid, key: "My Style" }).success).toBe(false);
  });
});
