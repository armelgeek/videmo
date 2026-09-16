import { prisma } from "@/lib/prisma";
import { TIERS, UNLIMITED, getTierDefinition } from "./catalog";
import { QuotaExceededError } from "./errors";
import { PAID_SUBSCRIPTION_STATUSES } from "./wallet-policy";

export interface UserPlan {
  tier: string;
  isPaid: boolean;
  quotas: Record<string, number>;
}

export interface UserPlanDeps {
  findPaidTiers(userId: string): Promise<{ tier: string; quotas: { key: string; value: number }[] }[]>;
  findFreePlan(): Promise<{ tier: string; quotas: { key: string; value: number }[] } | null>;
}

const planSelect = {
  tier: true,
  quotas: { select: { key: true, value: true } },
} as const;

export const prismaUserPlanDeps: UserPlanDeps = {
  findPaidTiers: async (userId) => {
    const subscriptions = await prisma.subscription.findMany({
      where: { userId, status: { in: [...PAID_SUBSCRIPTION_STATUSES] } },
      select: { plan: { select: planSelect } },
    });
    return subscriptions.map((subscription) => subscription.plan);
  },
  findFreePlan: () =>
    prisma.plan.findFirst({ where: { tier: "free", isActive: true }, select: planSelect }),
};

function tierRank(tier: string): number {
  const rank = TIERS.indexOf(tier as (typeof TIERS)[number]);
  return rank === -1 ? 0 : rank;
}

// Organization quotas live on the organization's plan, but creating an organization happens
// before one exists — so the allowance comes from the user's own highest active subscription.
export async function getUserPlan(
  userId: string,
  deps: UserPlanDeps = prismaUserPlanDeps,
): Promise<UserPlan> {
  const paid = await deps.findPaidTiers(userId);
  const best = paid.reduce<(typeof paid)[number] | null>(
    (highest, plan) => (highest && tierRank(highest.tier) >= tierRank(plan.tier) ? highest : plan),
    null,
  );
  const source = best ?? (await deps.findFreePlan());
  if (!source) throw new Error("No free plan configured — run seed:plans");

  return {
    tier: source.tier,
    isPaid: best !== null,
    quotas: {
      ...getTierDefinition(source.tier)?.quotas,
      ...Object.fromEntries(source.quotas.map((quota) => [quota.key, quota.value])),
    },
  };
}

export function countOwnedOrganizations(userId: string): Promise<number> {
  return prisma.organizationMember.count({ where: { userId, role: "owner" } });
}

export interface OrganizationQuotaCheck {
  allowed: boolean;
  limit: number;
  current: number;
}

export async function checkOrganizationQuota(userId: string): Promise<OrganizationQuotaCheck> {
  const [plan, current] = await Promise.all([getUserPlan(userId), countOwnedOrganizations(userId)]);
  const limit = plan.quotas.max_organizations ?? 1;
  return { allowed: limit === UNLIMITED || current < limit, limit, current };
}

export async function assertOrganizationQuota(userId: string): Promise<void> {
  const check = await checkOrganizationQuota(userId);
  if (!check.allowed) {
    throw new QuotaExceededError("max_organizations", check.limit, check.current);
  }
}
