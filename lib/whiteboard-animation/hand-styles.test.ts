import { describe, expect, it } from "vitest";
import { CUSTOM_HANDS } from "./lib/hands";
import { HAND_STYLES, isHandStyle } from "./hand-styles";

describe("hand styles", () => {
  it("are exactly the hand sprites the engine ships", () => {
    // A style naming a hand the engine lacks renders without one, silently.
    expect(HAND_STYLES.map((h) => h.key).sort()).toEqual(Object.keys(CUSTOM_HANDS).sort());
  });

  it("recognises a real hand and rejects an invented one", () => {
    expect(isHandStyle("custom2")).toBe(true);
    expect(isHandStyle("robot")).toBe(false);
  });
});
