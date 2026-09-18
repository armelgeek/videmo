import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserSubscription } from "@/actions/payments";
import { getActivePlans } from "@/actions/payments/get-plans";
import { PricingCards } from "@/components/molecules/cards/pricing-cards";
import { BillingOverview } from "@/components/organisms/billing/billing-overview";
import BillingClient from "@/components/templates/billing-client";
import { AppShell } from "@/lib/app-shell";
import { SketchHint } from "@/components/molecules/sketch-hint";
import { NotebookBackground } from "@/components/organisms/workspace/notebook-background";

export const metadata: Metadata = {
  title: "Billing | Manage Your Subscription",
  description: "View and manage your subscription plan and billing information",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const [{ subscription, canManage }, { plans }, { interval }] = await Promise.all([
    getUserSubscription(),
    getActivePlans(),
    searchParams,
  ]);

  return (
    <AppShell contentClassName="bg-background">
      <NotebookBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-8 py-6 sm:px-12">
        <header className="mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-extrabold text-foreground">
              <span className="sk-marker">Billing</span>
            </h1>
            <SketchHint direction="left" className="hidden text-lg sm:flex">
              your credits, plan and invoices in one place
            </SketchHint>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Credits, plan usage and subscription for your organization
          </p>
        </header>

        <BillingOverview
          hasSubscription={Boolean(subscription)}
          subscriptionSlot={
            <BillingClient subscription={subscription || null} canManage={canManage ?? false} />
          }
        />

        {canManage && plans && plans.length > 0 && (
          <section id="plans" className="mt-12 scroll-mt-6">
            <h2 className="mb-6 text-2xl font-extrabold text-foreground">
              <span className="sk-marker">Plans</span>
            </h2>
            <PricingCards
              plans={plans}
              isLoggedIn
              currentPlanId={subscription?.planId ?? null}
              hasSubscription={Boolean(subscription)}
              initialInterval={interval === "yearly" ? "yearly" : "monthly"}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
