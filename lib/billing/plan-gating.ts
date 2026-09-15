import { prisma } from "@/lib/prisma";
import { type FeatureKey, type QuotaKey, getTierDefinition } from "./catalog";
import { FeatureNotAvailableError, QuotaExceededError } from "./errors";
import { isWithinLimit, remainingUnderLimit } from "./ledger";
import { PAID_SUBSCRIPTION_STATUSES } from "./wallet-policy";

export interface PlanWithLimits {
  id: string;
  name: string;
  tier: string;
  quotas: { key: string; value: number }[];
  featureGates: { key: string; enabled: boolean }[];
}

export interface OrgPlan {
  planId: string;
  name: string;
  tier: string;
  isPaid: boolean;
  quotas: Record<string, number>;
  features: Record<string, boolean>;
}

export interface PlanGatingDeps {
  findPaidPlan(organizationId: string): Promise<PlanWithLimits | null>;
  findFreePlan(): Promise<PlanWithLimits | null>;
  now(): number;
}

const limitsInclude = {
  quotas: { select: { key: true, value: true } },
  featureGates: { select: { key: true, enabled: true } },
} as const;

export const prismaPlanGatingDeps: PlanGatingDeps = {
  findPaidPlan: async (organizationId) => {
    const subscription = await prisma.subscription.findFirst({
      where: { organizationId, status: { in: [...PAID_SUBSCRIPTION_STATUSES] } },
      orderBy: { createdAt: "desc" },
      select: { plan: { include: limitsInclude } },
    });
    return subscription?.plan ?? null;
  },
  findFreePlan: () =>
    prisma.plan.findFirst({
      where: { tier: "free", isActive: true },
      include: limitsInclude,
    }),
  now: () => Date.now(),
};

export const PLAN_CACHE_TTL_MS = 60_000;
const cache = new Map<string, { plan: OrgPlan; expiresAt: number }>();

export function invalidatePlanCache(organizationId?: string): void {
  if (organizationId) cache.delete(organizationId);
  else cache.clear();
}

function toOrgPlan(plan: PlanWithLimits, isPaid: boolean): OrgPlan {
  // Keys missing in the database fall back to the catalog, then to "denied".
  const definition = getTierDefinition(plan.tier);
  return {
    planId: plan.id,
    name: plan.name,
    tier: plan.tier,
    isPaid,
    quotas: {
      ...definition?.quotas,
      ...Object.fromEntries(plan.quotas.map((q) => [q.key, q.value])),
    },
    features: {
      ...definition?.features,
      ...Object.fromEntries(plan.featureGates.map((f) => [f.key, f.enabled])),
    },
  };
}

export async function getOrgPlan(
  organizationId: string,
  deps: PlanGatingDeps = prismaPlanGatingDeps,
): Promise<OrgPlan> {
  const now = deps.now();
  const cached = cache.get(organizationId);
  if (cached && cached.expiresAt > now) return cached.plan;

  const paid = await deps.findPaidPlan(organizationId);
  const source = paid ?? (await deps.findFreePlan());
  if (!source) throw new Error("No free plan configured — run seed:plans");

  const plan = toOrgPlan(source, paid !== null);
  cache.set(organizationId, { plan, expiresAt: now + PLAN_CACHE_TTL_MS });
  return plan;
}

export async function hasFeature(
  organizationId: string,
  feature: FeatureKey,
  deps?: PlanGatingDeps,
): Promise<boolean> {
  const plan = await getOrgPlan(organizationId, deps);
  return plan.features[feature] === true;
}

export async function assertFeature(
  organizationId: string,
  feature: FeatureKey,
  deps?: PlanGatingDeps,
): Promise<void> {
  const plan = await getOrgPlan(organizationId, deps);
  if (plan.features[feature] !== true) throw new FeatureNotAvailableError(feature, plan.tier);
}

export interface QuotaCheck {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number | null;
}

export async function checkQuota(
  organizationId: string,
  quotaKey: QuotaKey,
  currentUsage: number,
  deps?: PlanGatingDeps,
): Promise<QuotaCheck> {
  const plan = await getOrgPlan(organizationId, deps);
  const limit = plan.quotas[quotaKey] ?? 0;
  return {
    allowed: isWithinLimit(limit, currentUsage),
    limit,
    current: currentUsage,
    remaining: remainingUnderLimit(limit, currentUsage),
  };
}

export async function assertQuota(
  organizationId: string,
  quotaKey: QuotaKey,
  currentUsage: number,
  deps?: PlanGatingDeps,
): Promise<void> {
  const check = await checkQuota(organizationId, quotaKey, currentUsage, deps);
  if (!check.allowed) throw new QuotaExceededError(quotaKey, check.limit, check.current);
}
