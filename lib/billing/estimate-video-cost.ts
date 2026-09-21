import { CREDIT_ACTION_COSTS, type CreditAction } from "./catalog";

const COST = Object.fromEntries(
  CREDIT_ACTION_COSTS.map(({ action, cost }) => [action, cost]),
) as Record<CreditAction, number>;

export interface VideoCostEstimate {
  /** What the whole video costs, from the brief to the last drawing. */
  total: number;
  script: number;
  storyboard: number;
  images: number;
  narration: number;
  scenes: number;
}

/**
 * What a video will cost before a single credit is spent.
 *
 * A format's paragraph count is its scene count, and every scene is drawn and
 * narrated, so the bill is dominated by the drawings: a ten-scene explainer
 * costs more than a month of the free plan. Showing it up front is what stops
 * a first video from stalling half-drawn.
 */
export function estimateVideoCost(scenes: number): VideoCostEstimate {
  const safeScenes = Math.max(0, Math.floor(scenes));
  const images = COST.generate_image * safeScenes;
  const narration = COST.generate_narration * safeScenes;

  return {
    scenes: safeScenes,
    script: COST.generate_script,
    storyboard: COST.generate_storyboard,
    images,
    narration,
    total: COST.generate_script + COST.generate_storyboard + images + narration,
  };
}
