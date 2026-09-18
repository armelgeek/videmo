import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getUserSubscription } from "@/actions/payments";
import { getActivePlans } from "@/actions/payments/get-plans";
import { BillingContainer } from "@/components/organisms/billing/billing-container";
import { AppShell } from "@/lib/app-shell";
import { SketchHint } from "@/components/molecules/sketch-hint";
import { NotebookBackground } from "@/components/organisms/workspace/notebook-background";

export const metadata: Metadata = {
  title: "Billing & Subscription | SketchPilot",
  description: "Manage your organization subscription plan, credits, usage quotas and invoices",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string; tab?: string }>;
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
      <div className="relative min-h-screen">
        <NotebookBackground />
        <div className="relative z-10 w-full px-6 py-6 sm:px-8">
          <header className="mb-8">
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
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

          <BillingContainer
            subscription={subscription || null}
            canManage={canManage ?? false}
            plans={plans || []}
            initialInterval={interval === "yearly" ? "yearly" : "monthly"}
          />
        </div>
      </div>
    </AppShell>
  );
}
