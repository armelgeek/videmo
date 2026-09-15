import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserSubscription } from "@/actions/payments";
import { BillingOverview } from "@/components/organisms/billing/billing-overview";
import BillingClient from "@/components/templates/billing-client";
import { AppShell } from "@/lib/app-shell";

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
      <div className="px-6 py-4 sm:px-8">
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-foreground">
              <span className="sk-marker">Billing</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Credits, plan usage and subscription for your organization</p>
          </div>

          <div className="space-y-8">
            <BillingOverview />
            <BillingClient subscription={subscription || null} canManage={canManage ?? false} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
