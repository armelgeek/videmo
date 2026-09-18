"use server";

import {
  BillingAccessError,
  billingAccessMessage,
  getBillingViewer,
} from "@/lib/billing/billing-access";
import { getWallet } from "@/lib/billing/credit-service";
import { countActiveProjects, countSeats, storageUsedBytes } from "@/lib/billing/org-usage";
import { getOrgPlan } from "@/lib/billing/plan-gating";
import { checkOrganizationQuota } from "@/lib/billing/user-plan";

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
  maxVideoDurationSec: number;
  features: { premiumStyles: boolean; removeWatermark: boolean; apiAccess: boolean; customBranding: boolean };
  usage: {
    projects: { current: number; limit: number };
    members: { current: number; limit: number };
    storageGb: { current: number; limit: number };
    // User-scoped, unlike the others: omitted for viewers who own no organization.
    organizations: { current: number; limit: number } | null;
  };
}

export async function getCreditSummary(): Promise<{ summary: CreditSummary } | { error: string }> {
  try {
    const viewer = await getBillingViewer();
    const [wallet, plan, projects, seats, organizations, storageBytes] = await Promise.all([
      getWallet(viewer.organizationId),
      getOrgPlan(viewer.organizationId),
      countActiveProjects(viewer.organizationId),
      countSeats(viewer.organizationId),
      checkOrganizationQuota(viewer.userId),
      storageUsedBytes(viewer.organizationId),
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
        maxVideoDurationSec: plan.quotas.max_video_duration_sec ?? 0,
        features: {
          premiumStyles: plan.features.premium_templates === true,
          removeWatermark: plan.features.remove_watermark === true,
          apiAccess: plan.features.api_access === true,
          customBranding: plan.features.custom_branding === true,
        },
        usage: {
          projects: { current: projects, limit: plan.quotas.max_projects ?? 0 },
          members: { current: seats, limit: plan.quotas.max_org_members ?? 1 },
          storageGb: {
            current: Math.round((storageBytes / 1024 ** 3) * 100) / 100,
            limit: plan.quotas.max_storage_gb ?? 0,
          },
          organizations:
            organizations.current > 0
              ? { current: organizations.current, limit: organizations.limit }
              : null,
        },
      },
    };
  } catch (error) {
    if (error instanceof BillingAccessError) return { error: billingAccessMessage(error) };
    console.error("[billing] Failed to load credit summary:", error);
    return { error: "Could not load your credits" };
  }
}
