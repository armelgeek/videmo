"use client";

import { useMemo } from "react";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";
import { Tour, TOUR_TARGET, at, type TourStep } from "./tour";

/**
 * The walk through the workspace, once there is something in it.
 *
 * An empty workspace already says what to do, at length. A full one says very
 * little: the three marks under a project's name are drawn with a `title`
 * attribute and nothing else, so what they mean is a hover away at best.
 */
export function WorkspaceTour() {
  const { summary } = useCreditSummary();
  const limit = summary?.usage.projects.limit ?? 0;
  const capped = limit > 0;

  const steps = useMemo<TourStep[]>(() => {
    const base: TourStep[] = [
      {
        target: at(TOUR_TARGET.project),
        title: "It waits where you left it",
        content:
          "The three marks are the road: script, storyboard, animation. Open a project and you land on the step it stopped at — and when a teammate is editing it, their name sits on the thumbnail.",
      },
    ];

    if (!capped) return base;

    return [
      ...base,
      {
        target: at(TOUR_TARGET.newProject),
        title: `Your plan keeps ${limit} project${limit === 1 ? "" : "s"}`,
        content:
          "Finished videos stay downloadable for a day after the render, so a project can be deleted once you have the file.",
      },
    ];
  }, [capped, limit]);

  return <Tour group="workspace" steps={steps} />;
}
