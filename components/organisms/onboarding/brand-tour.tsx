"use client";

import { Tour, TOUR_TARGET, at, type TourStep } from "./tour";

/**
 * The walk through the brand kit.
 *
 * Two things this screen does not say. A card's actions only appear under the
 * pointer, so the one that matters most — making a row the default every new
 * video starts from — is invisible until someone happens to hover. And the
 * split between a format and a style is the whole model of the product, said
 * nowhere but in a subtitle.
 */
const STEPS: TourStep[] = [
  {
    target: at(TOUR_TARGET.libraryCard),
    title: "Point at a card",
    content:
      "Its actions appear: edit your own, or copy one of ours under the same name — Revert always brings the original back. “Use by default” makes it what every new video starts from.",
  },
  {
    target: at(TOUR_TARGET.brandTabs),
    title: "A type is not a look",
    content:
      "A format decides what the script says and in which order. A style decides the hand it is drawn in. Any type works with any look, which is why they are two lists.",
  },
];

export function BrandTour() {
  return <Tour group="brand" steps={STEPS} />;
}
