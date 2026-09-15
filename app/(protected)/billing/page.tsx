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
    <AppShell>
      <div className="px-6 pb-14 pt-10 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-extrabold text-foreground">
              <span className="sk-marker">Billing</span>
            </h1>
            <p className="sk-scribble mt-2 -rotate-1 text-lg">your plan and billing settings</p>
          </div>

          <BillingClient subscription={subscription || null} />
        </div>
      </div>
    </AppShell>
  );
}
