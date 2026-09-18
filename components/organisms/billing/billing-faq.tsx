import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BILLING_FAQS } from "@/lib/billing/faq";
import { HelpCircle } from "lucide-react";

export function BillingFaq() {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
          <HelpCircle className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-foreground sm:text-2xl">
            <span className="sk-marker">Frequently Asked Questions</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Everything you need to know about plans, billing, rollovers, and payments.
          </p>
        </div>
      </div>

      <div className="rounded-xl border-2 border-ink bg-card px-6 shadow-[5px_5px_0_hsl(var(--offset))]">
        <Accordion type="single" collapsible className="w-full">
          {BILLING_FAQS.map((f, i) => (
            <AccordionItem
              key={f.question}
              value={f.question}
              className={i === BILLING_FAQS.length - 1 ? "border-b-0" : "border-b border-border/60"}
            >
              <AccordionTrigger className="text-left text-sm font-semibold hover:no-underline hover:text-primary transition-colors py-4">
                {f.question}
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground leading-relaxed pb-4">
                {f.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
