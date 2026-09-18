"use client";

import { useState } from "react";
import { Loader2, Zap, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { createCreditPurchaseCheckout } from "@/actions/payments/create-credit-purchase";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CREDIT_PACKS,
  type CreditPackId,
  PURCHASED_CREDITS_VALIDITY_MONTHS,
  videoMinutesFor,
} from "@/lib/billing/catalog";

const PACK_IDS = Object.keys(CREDIT_PACKS) as CreditPackId[];

interface CreditTopupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreditTopupDialog({ open, onOpenChange }: CreditTopupDialogProps) {
  const [pendingPack, setPendingPack] = useState<CreditPackId | null>(null);

  const buy = async (packId: CreditPackId) => {
    setPendingPack(packId);
    const result = await createCreditPurchaseCheckout(packId);
    if (result.error || !result.url) {
      toast.error(result.error ?? "Could not start checkout");
      setPendingPack(null);
      return;
    }
    window.location.assign(result.url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
              <Zap className="h-4 w-4" />
            </div>
            <DialogTitle className="text-lg font-bold">
              <span className="sk-marker">Instant Credit Top-up</span>
            </DialogTitle>
          </div>
          <DialogDescription className="mt-1.5 text-xs text-muted-foreground">
            One-time purchase for your organization. Purchased credits stay valid for{" "}
            <span className="font-semibold text-foreground">{PURCHASED_CREDITS_VALIDITY_MONTHS} months</span> and
            are used automatically when your monthly allowance runs out.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2.5 py-2">
          {PACK_IDS.map((id) => {
            const pack = CREDIT_PACKS[id];
            const isProcessing = pendingPack === id;

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => buy(id)}
                  disabled={pendingPack !== null}
                  className="group flex w-full items-center justify-between gap-4 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-ink hover:shadow-[3px_3px_0_hsl(var(--offset))] hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-60"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{pack.label}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        ≈ {videoMinutesFor(pack.credits)} min
                      </span>
                    </div>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {(pack.amount / pack.credits).toFixed(1)}¢ per credit
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-bold tabular-nums text-foreground">
                    {isProcessing && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                    )}
                    <span className="text-base">${(pack.amount / 100).toFixed(2)}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Encrypted payment processed securely via Stripe</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
