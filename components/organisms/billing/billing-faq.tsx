import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  CREDITS_PER_VIDEO_MINUTE,
  CREDIT_ACTION_COSTS,
  PURCHASED_CREDITS_VALIDITY_MONTHS,
} from "@/lib/billing/catalog";

const costs = CREDIT_ACTION_COSTS.map((c) => `${c.label}: ${c.cost}`).join(" · ");

const FAQS = [
  {
    q: "What are credits?",
    a: "Credits pay for the AI steps of a video: writing the script, splitting it into scenes, drawing each image and recording the voiceover. Drawing, editing and exporting use no credits.",
  },
  {
    q: "How many credits does a video take?",
    a: `About ${CREDITS_PER_VIDEO_MINUTE} credits for one minute (around 6 scenes). Per step: ${costs} per scene. Regenerating a step costs it again.`,
  },
  {
    q: "Do unused credits roll over?",
    a: `Monthly plan credits reset each month and don't roll over. Purchased credits are kept for ${PURCHASED_CREDITS_VALIDITY_MONTHS} months and are spent only once your monthly credits run out.`,
  },
  {
    q: "What happens on a yearly plan?",
    a: "You pay once a year at the discounted price and still receive your credits every month.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Yes, anytime from this page. A plan change is prorated by Stripe. After cancelling you keep your plan until the end of the paid period, then move to Free.",
  },
];

export function BillingFaq() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-extrabold text-foreground">Questions about billing</h2>
      <Accordion type="single" collapsible className="rounded-lg border-2 border-border bg-card px-5">
        {FAQS.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
