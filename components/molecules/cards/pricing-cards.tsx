"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { getTierDefinition, videoMinutesFor } from "@/lib/billing/catalog";
import { cn } from "@/lib/utils";
import { createBillingPortalSession } from "@/actions/payments/create-billing-portal-session";
import { createCheckoutSession } from "@/actions/payments/create-checkout-session";
import { toast } from "sonner";

type PricingInterval = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: string;
  tier: string;
  features: string[];
  isPopular: boolean;
  stripePriceId: string;
}

interface PricingCardsProps {
  plans: Plan[];
  isLoggedIn: boolean;
  currentPlanId?: string | null;
  hasSubscription?: boolean;
  initialInterval?: PricingInterval;
}

export const PricingCards = ({
  plans,
  isLoggedIn,
  currentPlanId = null,
  hasSubscription = false,
  initialInterval = "monthly",
}: PricingCardsProps) => {
  const [interval, setInterval] = useState<PricingInterval>(initialInterval);
  const [isPending, startTransition] = useTransition();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  // Free has a single monthly row; it belongs in both views.
  const filteredPlans = plans.filter(
    (plan) =>
      plan.tier === "free" || plan.interval === (interval === "monthly" ? "month" : "year"),
  );

  const handleBuyNow = (planId: string) => {
    if (!isLoggedIn) {
      toast.error("Please login to purchase a plan");
      window.location.assign("/login");
      return;
    }

    const plan = filteredPlans.find((p) => p.id === planId);
    if (plan?.stripePriceId.startsWith("price_") && !plan.stripePriceId.includes("_1")) {
      toast.error("Payment system is being configured. Please try again later.");
      console.error("Placeholder Stripe Price ID detected:", plan.stripePriceId);
      return;
    }

    setLoadingPlanId(planId);
    startTransition(async () => {
      const result = await createCheckoutSession(planId);

      if (result.error) {
        toast.error(result.error);
        setLoadingPlanId(null);
        return;
      }

      if (result.url) {
        window.location.assign(result.url);
      }
    });
  };

  const handleSwitchPlan = (planId: string) => {
    setLoadingPlanId(planId);
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if (result.error || !result.url) {
        toast.error(result.error ?? "Could not open the billing portal");
        setLoadingPlanId(null);
        return;
      }
      window.location.assign(result.url);
    });
  };

  const money = (cents: number) => `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
  const monthlyAmount = (tier: string) =>
    plans.find((p) => p.tier === tier && p.interval === "month")?.amount ?? 0;
  const yearlySaving = Math.max(
    0,
    ...plans
      .filter((p) => p.interval === "year")
      .map((p) => {
        const monthly = monthlyAmount(p.tier);
        return monthly ? Math.round((1 - p.amount / (monthly * 12)) * 100) : 0;
      }),
  );

  const renderAction = (plan: Plan) => {
    const isFree = plan.tier === "free";
    const isLoading = isPending && loadingPlanId === plan.id;
    const isCurrent = isLoggedIn && (isFree ? !hasSubscription : plan.id === currentPlanId);
    const variant = plan.isPopular ? "default" : "outline";

    if (isCurrent) {
      return (
        <div className="inline-flex h-11 w-full items-center justify-center rounded-lg border-2 border-border bg-muted/40 text-sm font-semibold text-muted-foreground opacity-60">
          Current Plan
        </div>
      );
    }

    if (isFree) {
      return (
        isLoggedIn ? (
          <div className="inline-flex h-11 w-full items-center justify-center rounded-lg border-2 border-border bg-muted/40 text-sm font-semibold text-muted-foreground opacity-60">
            Free Plan
          </div>
        ) : (
          <Link
            href="/signup"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-ink bg-card px-4 text-sm font-semibold text-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px hover:bg-accent"
          >
            Start Free
          </Link>
        )
      );
    }

    if (hasSubscription) {
      return (
        <button
          type="button"
          onClick={() => handleSwitchPlan(plan.id)}
          disabled={isLoading}
          className={cn(
            "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-ink px-4 text-sm font-semibold shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-60",
            plan.isPopular
              ? "bg-highlight text-highlight-foreground"
              : "bg-card text-foreground hover:bg-accent",
          )}
        >
          {isLoading ? "Redirecting…" : "Switch Plan"}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleBuyNow(plan.id)}
        disabled={isLoading}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-ink px-4 text-sm font-semibold shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-60",
          plan.isPopular
            ? "bg-highlight text-highlight-foreground"
            : "bg-card text-foreground hover:bg-accent",
        )}
      >
        {isLoading ? "Starting checkout…" : "Upgrade Plan"}
      </button>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            <span className="sk-marker">Available Plans</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Scale your credits, resolution and workspace features as your team grows.
          </p>
        </div>

        {/* Interval toggle pill */}
        <div className="inline-flex items-center rounded-full border-2 border-ink bg-card p-1 shadow-[3px_3px_0_hsl(var(--offset))]">
          {(["monthly", "yearly"] as const).map((i) => {
            const active = interval === i;
            return (
              <button
                key={i}
                type="button"
                aria-pressed={active}
                onClick={() => setInterval(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                  active
                    ? "border-2 border-ink bg-highlight text-highlight-foreground font-bold shadow-[2px_2px_0_hsl(var(--offset))]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="capitalize">{i}</span>
                {i === "yearly" && yearlySaving > 0 && (
                  <span className="rounded-full border border-ink bg-ink text-background px-1.5 py-0.5 text-[10px] font-bold">
                    Save {yearlySaving}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {filteredPlans.map((plan, index) => {
          const credits = getTierDefinition(plan.tier)?.quotas.monthly_credits ?? 0;
          const yearly = plan.interval === "year";
          const perMonth = yearly ? plan.amount / 12 : plan.amount;
          const previous = index > 0 ? filteredPlans[index - 1] : null;
          const features = plan.features.filter((f) => !/credits \/ month/.test(f));

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col justify-between rounded-xl bg-card p-6 transition-all",
                plan.isPopular
                  ? "border-2 border-ink shadow-[6px_6px_0_hsl(var(--offset))]"
                  : "border-2 border-border hover:border-ink hover:shadow-[4px_4px_0_hsl(var(--offset))]",
              )}
            >
              {plan.isPopular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full border-2 border-ink bg-highlight px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
                  <Sparkles className="h-3 w-3" />
                  Most popular
                </span>
              )}

              <div>
                <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                <p className="mt-1 min-h-10 text-xs text-muted-foreground leading-relaxed">
                  {plan.description}
                </p>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold tabular-nums text-foreground">
                    {money(Math.round(perMonth))}
                  </span>
                  <span className="text-xs text-muted-foreground">/month</span>
                  {yearly && (
                    <span className="text-xs text-muted-foreground line-through ml-1">
                      {money(monthlyAmount(plan.tier))}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {plan.tier === "free"
                    ? "Free forever"
                    : yearly
                      ? `${money(plan.amount)} billed yearly`
                      : "Billed monthly"}
                </p>

                <div className="mt-4 rounded-xl border border-border/60 bg-muted/25 px-3.5 py-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold tabular-nums text-foreground">
                      {credits.toLocaleString("en-US")}
                    </span>
                    <span className="text-muted-foreground">credits / mo</span>
                  </div>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    ≈ {videoMinutesFor(credits)} one-minute video
                    {videoMinutesFor(credits) === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-5">{renderAction(plan)}</div>
              </div>

              <div className="mt-6 border-t border-border/60 pt-5">
                {previous && previous.tier !== "free" && !features[0]?.startsWith("Everything in") && (
                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Everything in {previous.name}, plus:
                  </p>
                )}
                <ul className="space-y-2.5">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-foreground/90">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
