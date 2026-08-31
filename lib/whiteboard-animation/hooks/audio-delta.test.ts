import { describe, expect, it } from "vitest";
import { DRIFT_MAX_MS } from "./audio-delta";

describe("DRIFT_MAX_MS", () => {
  it("stays under the ~125ms audio/visual lag perception threshold", () => {
    // Correcting the narration is audible, so the tolerance has to be wide
    // enough to absorb jitter yet tight enough that the offset it allows
    // cannot itself be noticed.
    expect(DRIFT_MAX_MS).toBeGreaterThan(0);
    expect(DRIFT_MAX_MS).toBeLessThan(125);
  });
});
