import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserSubscription } from "@/actions/payments";
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

  const { subscription } = await getUserSubscription();

  return (
    <AppShell contentClassName="bg-background">
      <div className="px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-foreground">
              <span className="sk-marker">Billing</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">Manage your subscription and billing information</p>
          </div>

          <BillingClient subscription={subscription || null} />
        </div>
      </div>
    </AppShell>
  );
}
