import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserSubscription } from "@/actions/payments";
import { BillingOverview } from "@/components/organisms/billing/billing-overview";
import BillingClient from "@/components/templates/billing-client";
import { AppShell } from "@/lib/app-shell";
import { NotebookBackground } from "@/components/organisms/workspace/notebook-background";

export const metadata: Metadata = {
  title: "Billing | Manage Your Subscription",
  description: "View and manage your subscription plan and billing information",
};

export default async function BillingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  const { subscription, canManage } = await getUserSubscription();

  return (
    <AppShell contentClassName="bg-background">
      <NotebookBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-8 py-6 sm:px-12">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold text-foreground">
            <span className="sk-marker">Billing</span>
          </h1>
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
      </div>
    </AppShell>
  );
}
