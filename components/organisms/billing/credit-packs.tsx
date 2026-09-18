"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCreditPurchaseCheckout } from "@/actions/payments/create-credit-purchase";
import {
  CREDIT_PACKS,
  type CreditPackId,
  PURCHASED_CREDITS_VALIDITY_MONTHS,
  videoMinutesFor,
} from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";

const PACK_IDS = Object.keys(CREDIT_PACKS) as CreditPackId[];

export function CreditPacks() {
  const [selected, setSelected] = useState<CreditPackId>(PACK_IDS[1] ?? PACK_IDS[0]);
  const [pending, setPending] = useState(false);
  const pack = CREDIT_PACKS[selected];

  const buy = async () => {
    setPending(true);
    const result = await createCreditPurchaseCheckout(selected);
    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not start checkout");
      setPending(false);
      return;
    }
    window.location.assign(result.url);
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold text-foreground">Buy credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time top-up for this organization, on any plan. Used after your monthly credits, valid{" "}
          {PURCHASED_CREDITS_VALIDITY_MONTHS} months.
        </p>
      </div>

      <div className="grid gap-5 rounded-lg border-2 border-border bg-card p-5 md:grid-cols-[1fr_280px]">
        <div role="radiogroup" aria-label="Credit pack" className="grid gap-3 sm:grid-cols-3">
          {PACK_IDS.map((id) => {
            const p = CREDIT_PACKS[id];
            const on = id === selected;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setSelected(id)}
                className={cn(
                  "rounded-lg border-2 p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-highlight",
                  on ? "border-ink bg-highlight/20" : "border-border hover:border-ink",
                )}
              >
                <span className="block text-2xl font-extrabold tabular-nums text-foreground">
                  {p.credits.toLocaleString("en-US")}
                </span>
                <span className="block text-xs text-muted-foreground">credits</span>
                <span className="mt-3 block text-sm font-semibold tabular-nums">${(p.amount / 100).toFixed(2)}</span>
                <span className="block text-xs text-muted-foreground">
                  ≈ {videoMinutesFor(p.credits)} one-minute video{videoMinutesFor(p.credits) === 1 ? "" : "s"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Credits</span>
            <span className="font-semibold tabular-nums">{pack.credits.toLocaleString("en-US")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Rate</span>
            <span className="tabular-nums">{(pack.amount / pack.credits).toFixed(1)}¢ / credit</span>
          </div>
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-muted-foreground">Amount to pay</span>
            <span className="text-2xl font-extrabold tabular-nums">${(pack.amount / 100).toFixed(2)}</span>
          </div>
          <button
            type="button"
            onClick={buy}
            disabled={pending}
            className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg border-2 border-ink bg-highlight font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Buy {pack.credits.toLocaleString("en-US")} credits
          </button>
        </div>
      </div>
    </section>
  );
}
