"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { TourGuideClient } from "@sjmc11/tourguidejs";
import "@sjmc11/tourguidejs/dist/css/tour.min.css";
import "./tour.css";

/** Everything the tour points at carries one of these. */
export const TOUR_TARGET = {
  brief: "brief",
  examples: "examples",
} as const;

const at = (name: string) => `[data-tour="${name}"]`;

/**
 * The first walk through the studio.
 *
 * Two steps, in front of the empty box, because that is the only moment the
 * account is genuinely stuck: it does not know what to write. Everything after
 * it — the format, the hand, the voice — the wizard already asks one question
 * at a time, and a second guide narrating the first would be one voice too
 * many. What comes after the script deserves its own short tour, on the screen
 * where it happens.
 */
const GROUP = "studio";

const STEPS = [
  {
    target: at(TOUR_TARGET.brief),
    title: "Say what it is about",
    content:
      "One sentence is enough — the message, who it is for. The script is written from this.",
  },
  {
    target: at(TOUR_TARGET.examples),
    title: "Or borrow one of ours",
    content:
      "Nothing to test it on? Take one of these and watch the whole thing run without writing a word.",
  },
];

/**
 * Runs the tour once per browser, and again whenever it is asked for.
 *
 * `completeOnFinish` remembers it in localStorage, which is per device: a
 * second machine walks through it again. That is the library's own mechanism,
 * and cheap enough to live with until it is worth a column on the user.
 */
export function StudioTour() {
  const searchParams = useSearchParams();
  // "Show me around" links here; a first visit needs no asking.
  const replay = searchParams.get("tour") === "1";
  const tour = useRef<TourGuideClient | null>(null);

  useEffect(() => {
    const client = new TourGuideClient({
      steps: STEPS.map((step) => ({ ...step, group: GROUP })),
      completeOnFinish: true,
      rememberStep: true,
      // The point is to do the thing, not to watch it being pointed at.
      activeStepInteraction: true,
      exitOnEscape: true,
      exitOnClickOutside: false,
      showStepProgress: true,
      // Two steps: there is nothing to go back to from the first.
      hidePrev: true,
      showStepDots: true,
      stepDotsPlacement: "footer",
      // Warm grey over the cream page; the greener ink turned it khaki.
      backdropColor: "rgba(28, 25, 23, 0.5)",
      targetPadding: 8,
      nextLabel: "Next",
      prevLabel: "Back",
      finishLabel: "Start writing",
      dialogMaxWidth: 340,
      autoScrollSmooth: true,
    });
    tour.current = client;

    // A first visit starts it; a replay is asked for by the button.
    if (!client.isFinished(GROUP) || replay) {
      if (replay) client.deleteFinishedTour(GROUP);
      // After paint: the wizard's own targets must be in the document first.
      const timer = window.setTimeout(() => void client.start(GROUP), 400);
      return () => {
        window.clearTimeout(timer);
        void client.exit();
      };
    }

    return () => {
      void client.exit();
    };
  }, [replay]);

  return null;
}
