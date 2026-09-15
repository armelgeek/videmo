"use server";

import {
  BillingAccessError,
  billingAccessMessage,
  getBillingViewer,
} from "@/lib/billing/billing-access";
import { getWallet } from "@/lib/billing/credit-service";
import { countActiveProjects, countSeats } from "@/lib/billing/org-usage";
import { getOrgPlan } from "@/lib/billing/plan-gating";

export interface CreditSummary {
  organizationName: string;
  planName: string;
  tier: string;
  canManage: boolean;
  balance: number;
  planCredits: number;
  purchasedCredits: number;
  monthlyAllowance: number;
  resetAt: string;
  maxExportResolution: number;
  usage: {
    projects: { current: number; limit: number };
    members: { current: number; limit: number };
  };
}

export async function getCreditSummary(): Promise<{ summary: CreditSummary } | { error: string }> {
  try {
    const viewer = await getBillingViewer();
    const [wallet, plan, projects, seats] = await Promise.all([
      getWallet(viewer.organizationId),
      getOrgPlan(viewer.organizationId),
      countActiveProjects(viewer.organizationId),
      countSeats(viewer.organizationId),
    ]);

    return {
      summary: {
        organizationName: viewer.organizationName,
        planName: plan.name,
        tier: plan.tier,
        canManage: viewer.canManage,
        balance: wallet.totalBalance,
        planCredits: wallet.planCredits,
        purchasedCredits: wallet.purchasedCredits,
        monthlyAllowance: plan.quotas.monthly_credits ?? 0,
        resetAt: wallet.resetAt.toISOString(),
        maxExportResolution: plan.quotas.max_export_resolution ?? 0,
        usage: {
          projects: { current: projects, limit: plan.quotas.max_projects ?? 0 },
          members: { current: seats, limit: plan.quotas.max_org_members ?? 1 },
        },
      },
    };
  } catch (error) {
    if (error instanceof BillingAccessError) return { error: billingAccessMessage(error) };
    console.error("[billing] Failed to load credit summary:", error);
    return { error: "Could not load your credits" };
  }
}
