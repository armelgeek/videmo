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
  wizardNav: "wizard-nav",
  projects: "nav-projects",
  brand: "nav-brand",
} as const;

const at = (name: string) => `[data-tour="${name}"]`;

/**
 * The first walk through the studio.
 *
 * Every step points at something that exists on the prompt screen, so the tour
 * never talks about a button the account cannot see. It says what to do next
 * rather than naming what is on screen.
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
      "No idea to test it on? Take an example brief and watch the whole thing run without writing anything.",
  },
  {
    target: at(TOUR_TARGET.wizardNav),
    title: "Four short questions",
    content:
      "What it is about, the type of video, the hand it is drawn in, the voice that reads it. The cost is shown before anything is spent.",
  },
  {
    target: at(TOUR_TARGET.projects),
    title: "Your videos live here",
    content: "Every project you start is waiting in the workspace, at the step you left it on.",
  },
  {
    target: at(TOUR_TARGET.brand),
    title: "Then make it yours",
    content:
      "Your logo, the types of video you write and the hand they are drawn in. Set one as the default and every new video starts there.",
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
      showStepDots: true,
      stepDotsPlacement: "footer",
      backdropColor: "rgba(22, 22, 15, 0.55)",
      targetPadding: 8,
      nextLabel: "Next",
      prevLabel: "Back",
      finishLabel: "Got it",
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
