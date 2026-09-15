import { z } from "zod";
import { UNLIMITED } from "./catalog";
import { InsufficientCreditsError } from "./errors";

export interface PurchaseBalance {
  id: string;
  remainingCredits: number;
  expiresAt: Date;
}

export const debitSplitSchema = z.object({
  fromPlan: z.number().int().nonnegative(),
  fromPurchases: z.array(z.object({ id: z.string(), amount: z.number().int().positive() })),
});
export type DebitSplit = z.infer<typeof debitSplitSchema>;

export interface DebitPlan extends DebitSplit {
  source: "plan" | "purchased" | "mixed";
}

export function usablePurchases(purchases: PurchaseBalance[], now: Date): PurchaseBalance[] {
  return purchases
    .filter((p) => p.remainingCredits > 0 && p.expiresAt > now)
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
}

export function purchasedBalance(purchases: PurchaseBalance[], now: Date): number {
  return usablePurchases(purchases, now).reduce((sum, p) => sum + p.remainingCredits, 0);
}

// Plan credits first (they expire soonest), then purchases closest to expiry.
export function planDebit(
  planCredits: number,
  purchases: PurchaseBalance[],
  cost: number,
  now: Date,
): DebitPlan {
  const plan = Math.max(0, planCredits);
  const usable = usablePurchases(purchases, now);
  const available = plan + purchasedBalance(usable, now);
  if (available < cost) throw new InsufficientCreditsError(available, cost);

  const fromPlan = Math.min(cost, plan);
  let rest = cost - fromPlan;
  const fromPurchases: DebitSplit["fromPurchases"] = [];
  for (const purchase of usable) {
    if (rest === 0) break;
    const amount = Math.min(rest, purchase.remainingCredits);
    fromPurchases.push({ id: purchase.id, amount });
    rest -= amount;
  }

  const source = fromPurchases.length === 0 ? "plan" : fromPlan === 0 ? "purchased" : "mixed";
  return { fromPlan, fromPurchases, source };
}

export function isWithinLimit(limit: number, usage: number): boolean {
  return limit === UNLIMITED || usage < limit;
}

export function remainingUnderLimit(limit: number, usage: number): number | null {
  return limit === UNLIMITED ? null : Math.max(0, limit - usage);
}
