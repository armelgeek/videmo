"use client";

import { Tour, TOUR_TARGET, at, type TourStep } from "./tour";

/**
 * The walk through the storyboard.
 *
 * The screen already says "click a scene to edit it" and "happy with it? bring
 * it to life" in its own hand, so neither is repeated here. What it does not
 * say is that the script stopped being final — and what redrawing costs.
 */
const STEPS: TourStep[] = [
  {
    target: at(TOUR_TARGET.scenes),
    title: "Nothing here is final",
    content:
      "One scene per paragraph. Open one to rewrite what it draws, move it earlier or later, or drop it — the script stopped being final the moment it became scenes.",
  },
  {
    target: at(TOUR_TARGET.redraw),
    title: "Redrawing is not free",
    content:
      "This one redraws every scene, and each costs the same as the first time. To fix a single drawing, redraw that scene alone from its panel.",
  },
];

export function StoryboardTour() {
  return <Tour group="storyboard" steps={STEPS} />;
}
