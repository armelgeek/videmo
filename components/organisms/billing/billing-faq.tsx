import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BILLING_FAQS } from "@/lib/billing/faq";

export function BillingFaq() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-extrabold text-foreground">Questions about billing</h2>
      <Accordion type="single" collapsible className="rounded-lg border-2 border-border bg-card px-5">
        {BILLING_FAQS.map((f) => (
          <AccordionItem key={f.question} value={f.question}>
            <AccordionTrigger className="text-left font-semibold">{f.question}</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">{f.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
