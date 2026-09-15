"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Buy credits</DialogTitle>
          <DialogDescription>
            A one-time purchase for this organization. Purchased credits last{" "}
            {PURCHASED_CREDITS_VALIDITY_MONTHS} months and are used after your monthly plan credits.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-3 py-2">
          {PACK_IDS.map((id) => {
            const pack = CREDIT_PACKS[id];
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => buy(id)}
                  disabled={pendingPack !== null}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border-2 border-border bg-card p-4 text-left outline-none transition hover:border-ink focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-60"
                >
                  <span>
                    <span className="block font-semibold">{pack.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {(pack.amount / pack.credits).toFixed(1)}¢ per credit
                    </span>
                  </span>
                  <span className="flex items-center gap-2 font-semibold tabular-nums">
                    {pendingPack === id && (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    )}
                    ${(pack.amount / 100).toFixed(2)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="text-xs text-muted-foreground">
          You finish payment on Stripe&apos;s secure checkout.
        </p>
      </DialogContent>
    </Dialog>
  );
}
