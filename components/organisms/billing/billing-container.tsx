"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingOverview } from "./billing-overview";
import { PricingCards } from "@/components/molecules/cards/pricing-cards";
import { PlanComparison } from "./plan-comparison";
import { CreditPacks } from "./credit-packs";
import { BillingFaq } from "./billing-faq";
import BillingClient from "@/components/templates/billing-client";
import { LayoutDashboard, Sparkles, Zap, HelpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

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

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  planId?: string;
  plan: {
    id: string;
    name: string;
    description: string | null;
    amount: number;
    interval: string;
    features: string[];
    isPopular: boolean;
  };
}

interface BillingContainerProps {
  subscription: Subscription | null;
  canManage: boolean;
  plans: Plan[];
  initialInterval?: "monthly" | "yearly";
}

export function BillingContainer({
  subscription,
  canManage,
  plans,
  initialInterval = "monthly",
}: BillingContainerProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["overview", "plans", "packs", "faq"].includes(tabParam)) {
      return tabParam;
    }
    return "overview";
  });

  useEffect(() => {
    // Sync with hash if someone visits /billing#plans
    if (typeof window !== "undefined" && window.location.hash === "#plans") {
      setActiveTab("plans");
    }
  }, []);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", val);
    router.replace(`/billing?${params.toString()}`, { scroll: false });
  };

  const switchToPlans = () => {
    handleTabChange("plans");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="space-y-8">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
        {/* Sleek navigation bar */}
        <div className="border-b border-border/70 pb-3">
          <TabsList className="inline-flex h-11 items-center rounded-xl border-2 border-ink bg-card p-1 shadow-[3px_3px_0_hsl(var(--offset))]">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-ink data-[state=active]:bg-highlight data-[state=active]:text-highlight-foreground data-[state=active]:shadow-[2px_2px_0_hsl(var(--offset))] hover:text-foreground"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Overview & Usage</span>
            </TabsTrigger>

            {plans && plans.length > 0 && (
              <TabsTrigger
                value="plans"
                className="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-ink data-[state=active]:bg-highlight data-[state=active]:text-highlight-foreground data-[state=active]:shadow-[2px_2px_0_hsl(var(--offset))] hover:text-foreground"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Plans & Pricing</span>
              </TabsTrigger>
            )}

            {canManage && (
              <TabsTrigger
                value="packs"
                className="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-ink data-[state=active]:bg-highlight data-[state=active]:text-highlight-foreground data-[state=active]:shadow-[2px_2px_0_hsl(var(--offset))] hover:text-foreground"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Credit Packs</span>
              </TabsTrigger>
            )}

            <TabsTrigger
              value="faq"
              className="flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-all data-[state=active]:border-2 data-[state=active]:border-ink data-[state=active]:bg-highlight data-[state=active]:text-highlight-foreground data-[state=active]:shadow-[2px_2px_0_hsl(var(--offset))] hover:text-foreground"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>FAQ</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab: Overview */}
        <TabsContent value="overview" className="space-y-8 outline-none">
          <BillingOverview
            hasSubscription={Boolean(subscription)}
            onSelectPlansTab={switchToPlans}
            subscriptionSlot={
              <BillingClient
                subscription={subscription || null}
                canManage={canManage}
                onSelectPlansTab={switchToPlans}
              />
            }
          />

          {canManage && plans && plans.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border-2 border-ink bg-card p-6 shadow-[4px_4px_0_hsl(var(--offset))]">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Looking to scale your video production?
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Explore Pro and Enterprise plans with higher quotas, 4K export, and team members.
                </p>
              </div>
              <button
                type="button"
                onClick={switchToPlans}
                className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-xs font-bold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight"
              >
                Compare all plans
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </TabsContent>

        {/* Tab: Plans & Pricing */}
        {plans && plans.length > 0 && (
          <TabsContent value="plans" className="space-y-12 outline-none">
            <section id="plans" className="scroll-mt-8">
              <PricingCards
                plans={plans}
                isLoggedIn
                currentPlanId={subscription?.planId ?? null}
                hasSubscription={Boolean(subscription)}
                initialInterval={initialInterval}
              />
            </section>

            <PlanComparison />
          </TabsContent>
        )}

        {/* Tab: Credit Packs */}
        {canManage && (
          <TabsContent value="packs" className="space-y-8 outline-none">
            <CreditPacks />
          </TabsContent>
        )}

        {/* Tab: FAQ */}
        <TabsContent value="faq" className="space-y-8 outline-none">
          <BillingFaq />
        </TabsContent>
      </Tabs>
    </div>
  );
}
