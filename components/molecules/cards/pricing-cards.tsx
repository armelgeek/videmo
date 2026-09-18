"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
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

  const formatPrice = (amount: number) => {
    return (amount / 100).toFixed(2);
  };

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
        <Button asChild className="w-full" size="lg" variant="outline">
          <Link href={isLoggedIn ? "/billing" : "/login"}>
            {isLoggedIn ? "Manage in billing" : "Start free"}
          </Link>
        </Button>
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
    <div className="space-y-10">
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-full border bg-muted/50 p-1">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
              interval === "monthly"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2 ${
              interval === "yearly"
                ? "bg-card shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-foreground text-background border-0">
              Save 17%
            </Badge>
          </button>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
        {filteredPlans.map((plan) => (
          <Card
            key={plan.id}
            className={`relative flex flex-col transition-all duration-300 ${
              plan.isPopular
                ? "border-foreground border-2 shadow-md scale-[1.02]"
                : "hover:shadow-sm"
            }`}
          >
            {plan.isPopular && (
              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                <Badge className="px-4 py-1 bg-foreground text-background border-0 shadow-sm">Most Popular</Badge>
              </div>
            )}

            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
            </CardHeader>

            <CardContent className="flex-1 space-y-6">
              <div className="text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl font-bold">
                    ${formatPrice(plan.amount)}
                  </span>
                  <span className="text-muted-foreground">
                    {plan.tier === "free" ? "forever" : `/${interval === "monthly" ? "mo" : "yr"}`}
                  </span>
                </div>
              </div>

              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>{renderAction(plan)}</CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};
