"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { TourGuideClient } from "@sjmc11/tourguidejs";
import "@sjmc11/tourguidejs/dist/css/tour.min.css";
import "./tour.css";

export interface TourStep {
  /** A `[data-tour="…"]` selector; the element must be on screen already. */
  target: string;
  title: string;
  content: string;
}

/** Everything a tour points at carries one of these. */
export const TOUR_TARGET = {
  brief: "brief",
  examples: "examples",
  scenes: "scenes",
  redraw: "redraw",
} as const;

export const at = (name: string) => `[data-tour="${name}"]`;

/**
 * Runs a tour once per browser, and again whenever it is asked for.
 *
 * `completeOnFinish` remembers it in localStorage, which is per device: a
 * second machine walks through it again. That is the library's own mechanism,
 * and cheap enough to live with until it is worth a column on the user.
 *
 * Mount it only where all of its targets exist — a tour that points at
 * something off screen is worse than no tour.
 */
export function Tour({ group, steps }: { group: string; steps: TourStep[] }) {
  const searchParams = useSearchParams();
  // "Show me around" links here; a first visit needs no asking.
  const replay = searchParams.get("tour") === "1";

  useEffect(() => {
    const client = new TourGuideClient({
      steps: steps.map((step) => ({ ...step, group })),
      completeOnFinish: true,
      rememberStep: true,
      // The point is to do the thing, not to watch it being pointed at.
      activeStepInteraction: true,
      exitOnEscape: true,
      exitOnClickOutside: false,
      showStepProgress: true,
      // Short tours: there is nothing to go back to from the first step.
      hidePrev: true,
      showStepDots: true,
      stepDotsPlacement: "footer",
      // Warm grey over the cream page; the greener ink turned it khaki.
      backdropColor: "rgba(28, 25, 23, 0.5)",
      targetPadding: 8,
      nextLabel: "Next",
      finishLabel: "Got it",
      dialogMaxWidth: 340,
      autoScrollSmooth: true,
    });

    if (!client.isFinished(group) || replay) {
      if (replay) client.deleteFinishedTour(group);
      // After paint: the targets must be in the document first.
      const timer = window.setTimeout(() => void client.start(group), 400);
      return () => {
        window.clearTimeout(timer);
        void client.exit();
      };
    }

    return () => {
      void client.exit();
    };
  }, [group, steps, replay]);

  return null;
}
