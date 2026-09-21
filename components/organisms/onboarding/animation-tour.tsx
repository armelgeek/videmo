"use client";

import { useMemo } from "react";
import { appConfig } from "@/lib/config";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { Tour, TOUR_TARGET, at, type TourStep } from "./tour";

function cap(seconds: number | undefined): string | null {
  if (!seconds || seconds < 0) return null;
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} minutes`;
}

/**
 * The walk through the animation screen.
 *
 * The export dialog already explains itself — the resolution it cannot reach,
 * that the render survives the window closing, that the file lives 24 hours.
 * What nothing says before the wait is that a free export comes back stamped.
 * Finding that out on the finished video is the wrong moment.
 */
export function AnimationTour() {
  const { summary } = useCreditSummary();
  const stamped = summary != null && !summary.features.removeWatermark;
  const limit = stamped ? cap(summary?.maxVideoDurationSec) : null;

  const steps = useMemo<TourStep[]>(() => {
    const base: TourStep[] = [
      {
        target: at(TOUR_TARGET.mode),
        title: "Watch it before you render",
        content:
          "Preview plays the hand and the voice together, here and now. An export takes minutes, so it is worth being sure first.",
      },
    ];

    if (!stamped) return base;

    return [
      ...base,
      {
        target: at(TOUR_TARGET.export),
        title: "What a free export gives you",
        content: `The file comes back with a small “Made with ${appConfig.name}” stamp${
          limit ? `, and videos are capped at ${limit}` : ""
        }. The drawing, the voice and the timing are exactly what you previewed.`,
      },
    ];
  }, [stamped, limit]);

  return <Tour group="animation" steps={steps} />;
}
