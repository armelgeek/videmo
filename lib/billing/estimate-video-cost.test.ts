import { describe, expect, it } from "vitest";
import { estimateVideoCost } from "./estimate-video-cost";
import { BUILT_IN_FORMATS, DEFAULT_FORMAT_ID } from "@/lib/storyboard/formats";
import { TIER_CATALOG } from "./catalog";

const freeAllowance =
  TIER_CATALOG.find((tier) => tier.prices.month === 0)?.quotas.monthly_credits ?? 0;

describe("estimateVideoCost", () => {
  it("bills the script and the storyboard once, the drawing and the voice per scene", () => {
    // 5 + 10 + 6 × 12 + 6 × 2
    expect(estimateVideoCost(6)).toMatchObject({ total: 99, images: 72, narration: 12 });
  });

  it("still answers for a format with no movements yet", () => {
    expect(estimateVideoCost(0).total).toBe(15);
  });
});

describe("the free plan", () => {
  it("can pay for a whole video in the default format", () => {
    // The first video a new account makes must be one it can finish: running
    // out of credits half-drawn is the worst moment to meet a paywall.
    const format = BUILT_IN_FORMATS.find((f) => f.id === DEFAULT_FORMAT_ID)!;

    expect(estimateVideoCost(format.script.paragraphs).total).toBeLessThanOrEqual(freeAllowance);
  });
});
