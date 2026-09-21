"use client";

import { Tour, TOUR_TARGET, at, type TourStep } from "./tour";

/**
 * The first walk through the studio.
 *
 * Two steps, in front of the empty box, because that is the only moment the
 * account is genuinely stuck: it does not know what to write. Everything after
 * it — the format, the hand, the voice — the wizard already asks one question
 * at a time, and a second guide narrating the first would be one voice too
 * many.
 */
const STEPS: TourStep[] = [
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

export function StudioTour() {
  return <Tour group="studio" steps={STEPS} />;
}
