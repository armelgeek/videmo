import type { PrismaClient } from "@prisma/client";
import {
  type BillingInterval,
  CREDIT_ACTION_COSTS,
  TIER_CATALOG,
  type TierDefinition,
  placeholderPriceId,
} from "./catalog";

const LEGACY_TIER_BY_NAME: Record<string, TierDefinition["tier"]> = {
  Starter: "starter",
  Professional: "pro",
  Pro: "pro",
  Enterprise: "enterprise",
};

export interface StripeIds {
  priceId: string;
  productId: string;
}

// Rows created before Plan.tier existed all got the column default "starter".
export async function backfillLegacyTiers(client: PrismaClient): Promise<void> {
  for (const [name, tier] of Object.entries(LEGACY_TIER_BY_NAME)) {
    await client.plan.updateMany({ where: { name, NOT: { tier } }, data: { tier } });
  }
}

export function findTierPlan(client: PrismaClient, tier: string, interval: BillingInterval) {
  return client.plan.findFirst({
    where: { tier, interval },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertTierPlan(
  client: PrismaClient,
  definition: TierDefinition,
  interval: BillingInterval,
  stripeIds?: StripeIds,
) {
  const amount = definition.prices[interval];
  if (amount === undefined) {
    throw new Error(`Tier ${definition.tier} has no ${interval} price`);
  }

  const fields = {
    name: definition.name,
    description: definition.description,
    amount,
    currency: "usd",
    interval,
    tier: definition.tier,
    features: definition.displayFeatures,
    isPopular: definition.isPopular,
    isActive: true,
  };

  const existing = await findTierPlan(client, definition.tier, interval);
  const plan = existing
    ? await client.plan.update({
        where: { id: existing.id },
        data: {
          ...fields,
          ...(stripeIds && {
            stripePriceId: stripeIds.priceId,
            stripeProductId: stripeIds.productId,
          }),
        },
      })
    : await client.plan.create({
        data: {
          ...fields,
          stripePriceId: stripeIds?.priceId ?? placeholderPriceId(definition.tier, interval),
          stripeProductId: stripeIds?.productId ?? `prod_${definition.tier}`,
        },
      });

  await syncPlanLimits(client, plan.id, definition);
  return plan;
}

async function syncPlanLimits(client: PrismaClient, planId: string, definition: TierDefinition) {
  for (const [key, value] of Object.entries(definition.quotas)) {
    await client.planQuota.upsert({
      where: { planId_key: { planId, key } },
      create: { planId, key, value },
      update: { value },
    });
  }
  for (const [key, enabled] of Object.entries(definition.features)) {
    await client.planFeatureGate.upsert({
      where: { planId_key: { planId, key } },
      create: { planId, key, enabled },
      update: { enabled },
    });
  }
}

export async function syncActionCosts(client: PrismaClient): Promise<void> {
  for (const { action, cost, label } of CREDIT_ACTION_COSTS) {
    await client.creditActionCost.upsert({
      where: { action },
      create: { action, cost, label },
      update: { cost, label },
    });
  }
}

export async function syncPlanCatalog(client: PrismaClient): Promise<void> {
  await backfillLegacyTiers(client);
  for (const definition of TIER_CATALOG) {
    for (const interval of Object.keys(definition.prices) as BillingInterval[]) {
      await upsertTierPlan(client, definition, interval);
    }
  }
  await syncActionCosts(client);
}
