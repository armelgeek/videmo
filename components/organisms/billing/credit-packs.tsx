"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          <span className="sk-marker">Credit Top-Up Packs</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One-time credit packs for this organization. Valid for{" "}
          <span className="font-semibold text-foreground">{PURCHASED_CREDITS_VALIDITY_MONTHS} months</span> and
          automatically consumed after your regular monthly allowance.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Pack Selection Cards */}
        <div role="radiogroup" aria-label="Credit pack" className="grid gap-4 sm:grid-cols-3">
          {PACK_IDS.map((id) => {
            const p = CREDIT_PACKS[id];
            const isSelected = id === selected;

            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(id)}
                className={cn(
                  "relative flex flex-col justify-between rounded-xl p-5 text-left transition-all outline-none",
                  isSelected
                    ? "border-2 border-ink bg-highlight/20 shadow-[4px_4px_0_hsl(var(--offset))]"
                    : "border-2 border-border bg-card hover:border-ink hover:shadow-[3px_3px_0_hsl(var(--offset))]",
                )}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {p.label}
                    </span>
                    {isSelected && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink bg-highlight text-[10px] font-bold text-highlight-foreground">
                        ✓
                      </span>
                    )}
                  </div>

                  <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
                    {p.credits.toLocaleString("en-US")}
                  </p>
                  <p className="text-xs text-muted-foreground">credits</p>
                </div>

                <div className="mt-6 border-t border-border/60 pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-lg font-bold tabular-nums text-foreground">
                      ${(p.amount / 100).toFixed(2)}
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums font-semibold">
                      {(p.amount / p.credits).toFixed(1)}¢/cr
                    </span>
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    ≈ {videoMinutesFor(p.credits)} min video
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Checkout Summary Card */}
        <div className="flex flex-col justify-between rounded-xl border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-border/60">
              <Zap className="h-4 w-4 text-foreground" />
              <h3 className="text-sm font-bold text-foreground">Purchase Summary</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected Package</span>
                <span className="font-bold text-foreground">{pack.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Credits</span>
                <span className="font-bold tabular-nums text-foreground">
                  {pack.credits.toLocaleString("en-US")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost per credit</span>
                <span className="tabular-nums font-semibold text-foreground">
                  {(pack.amount / pack.credits).toFixed(1)}¢
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Validity</span>
                <span className="text-foreground">{PURCHASED_CREDITS_VALIDITY_MONTHS} months</span>
              </div>

              <div className="flex items-baseline justify-between border-t border-border/60 pt-3 text-sm">
                <span className="font-semibold text-muted-foreground">Total Due</span>
                <span className="text-2xl font-extrabold tabular-nums text-foreground">
                  ${(pack.amount / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              type="button"
              onClick={buy}
              disabled={pending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {pending ? "Preparing Checkout…" : `Buy ${pack.credits.toLocaleString("en-US")} Credits`}
            </button>

            <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Secure checkout powered by Stripe</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
