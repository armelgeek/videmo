"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { creditLevel } from "@/lib/billing/billing-notice";
import { useCreditSummary } from "@/lib/billing/use-credit-summary";

export function CreditBalanceBadge() {
  const { summary } = useCreditSummary();

  if (!summary) {
    return <div aria-hidden="true" className="h-9 rounded-lg bg-muted motion-safe:animate-pulse" />;
  }

  const isLow = creditLevel(summary.balance, summary.monthlyAllowance) === "low";

  return (
    <Link
      href="/billing"
      aria-label={`${summary.balance} credits left on the ${summary.planName} plan. Open billing.`}
      className={cn(
        "flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-highlight",
        isLow ? "border-destructive text-destructive" : "border-border text-foreground hover:border-ink",
      )}
    >
      <Zap className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">{summary.balance.toLocaleString("en-US")}</span>
      <span className="font-medium text-muted-foreground">credits</span>
      <span className="ml-auto text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {summary.planName}
      </span>
    </Link>
  );
}
