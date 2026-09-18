"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
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

  // Plan changes on an existing subscription go through Stripe's portal, which prorates them.
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
        <Button className="w-full" size="lg" variant="outline" disabled>
          Current plan
        </Button>
      );
    }

    if (isFree) {
      return (
        isLoggedIn ? (
          <Button className="w-full" size="lg" variant="outline" disabled>
            Free plan
          </Button>
        ) : (
          <Button asChild className="w-full" size="lg" variant="outline">
            <Link href="/signup">Start free</Link>
          </Button>
        )
      );
    }

    if (hasSubscription) {
      return (
        <Button
          className="w-full"
          size="lg"
          variant={variant}
          onClick={() => handleSwitchPlan(plan.id)}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : "Switch plan"}
        </Button>
      );
    }

    return (
      <Button
        className="w-full"
        size="lg"
        variant={variant}
        onClick={() => handleBuyNow(plan.id)}
        disabled={isLoading}
      >
        {isLoading ? "Loading..." : "Buy Now"}
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-foreground">
            <span className="sk-marker">Choose your plan</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            More credits, longer videos and every drawing style as you grow.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full border-2 border-ink bg-card p-1 shadow-[3px_3px_0_hsl(var(--offset))]">
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              onClick={() => setInterval(i)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                interval === i ? "bg-highlight text-highlight-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {i === "monthly" ? "Monthly" : "Yearly"}
              {i === "yearly" && yearlySaving > 0 && (
                <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-background">
                  −{yearlySaving}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
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
                "relative flex flex-col rounded-lg border-2 bg-card p-5",
                plan.isPopular
                  ? "border-ink shadow-[6px_6px_0_hsl(var(--offset))]"
                  : "border-border",
              )}
            >
              {plan.isPopular && (
                <span className="absolute -top-3 right-4 rounded border-2 border-ink bg-highlight px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-highlight-foreground">
                  Most popular
                </span>
              )}

              <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tabular-nums text-foreground">{money(Math.round(perMonth))}</span>
                <span className="text-sm text-muted-foreground">/month</span>
                {yearly && (
                  <span className="text-sm text-muted-foreground line-through">{money(monthlyAmount(plan.tier))}</span>
                )}
              </div>
              <p className="mt-1 h-4 text-xs text-muted-foreground">
                {plan.tier === "free" ? "Free forever" : yearly ? `${money(plan.amount)} billed yearly` : "Billed monthly"}
              </p>

              <div className="mt-4 rounded-md border border-dashed border-border px-3 py-2 text-sm">
                <span className="font-bold tabular-nums text-foreground">{credits.toLocaleString("en-US")}</span>{" "}
                <span className="text-muted-foreground">credits / month</span>
                <span className="block text-xs text-muted-foreground">
                  ≈ {videoMinutesFor(credits)} one-minute video{videoMinutesFor(credits) === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-4">{renderAction(plan)}</div>

              <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                {previous && previous.tier !== "free" && !features[0]?.startsWith("Everything in") && (
                  <li className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Everything in {previous.name}, plus
                  </li>
                )}
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};
