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
      <div className="px-8 py-4 sm:px-12 relative z-10">
        <div>
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-foreground">
              <span className="sk-marker">Billing</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Credits, plan usage and subscription for your organization</p>
          </div>

          <div className="space-y-6">
            {!subscription && (
              <div className="rounded-lg border-2 border-border bg-card p-4 shadow-[3px_3px_0_hsl(var(--offset))] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="h-5 w-5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2" /></svg>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      You&apos;re on the Free plan
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      Upgrade for more credits and features
                    </p>
                  </div>
                </div>
                <a href="/#pricing" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shrink-0 border-2 border-ink shadow-[2px_2px_0_hsl(var(--offset))]">
                  Upgrade
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </a>
              </div>
            )}
            <BillingOverview />
            <BillingClient subscription={subscription || null} canManage={canManage ?? false} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
