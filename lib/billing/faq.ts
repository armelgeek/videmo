import {
  CREDITS_PER_VIDEO_MINUTE,
  CREDIT_ACTION_COSTS,
  PURCHASED_CREDITS_VALIDITY_MONTHS,
} from "./catalog";

const costs = CREDIT_ACTION_COSTS.map((c) => `${c.label}: ${c.cost}`).join(" · ");

export const BILLING_FAQS = [
  {
    question: "What are credits?",
    answer:
      "Credits pay for the AI steps of a video: writing the script, splitting it into scenes, drawing each image and recording the voiceover. Drawing, editing and exporting use no credits.",
  },
  {
    question: "How many credits does a video take?",
    answer: `About ${CREDITS_PER_VIDEO_MINUTE} credits for one minute (around 6 scenes). Per step: ${costs} per scene. Regenerating a step costs it again.`,
  },
  {
    question: "Do unused credits roll over?",
    answer: `Monthly plan credits reset each month and don't roll over. Purchased credits are kept for ${PURCHASED_CREDITS_VALIDITY_MONTHS} months and are spent only once your monthly credits run out.`,
  },
  {
    question: "What happens on a yearly plan?",
    answer: "You pay once a year at the discounted price and still receive your credits every month.",
  },
  {
    question: "Can I change or cancel my plan?",
    answer:
      "Yes, anytime from your billing page. A plan change is prorated. After cancelling you keep your plan until the end of the paid period, then move to Free.",
  },
];
