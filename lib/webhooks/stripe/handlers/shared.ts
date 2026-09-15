import type Stripe from "stripe";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import { switchPlan } from "@/lib/billing/credit-service";
import { invalidatePlanCache } from "@/lib/billing/plan-gating";
import { type SubscriptionState, planTransition } from "@/lib/billing/stripe-rules";
import { prisma } from "@/lib/prisma";

export function stripeId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}

export function subscriptionFields(subscription: Stripe.Subscription) {
  return {
    status: subscription.status as string,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

export async function applyPlanTransition(
  organizationId: string,
  previous: SubscriptionState | null,
  next: SubscriptionState,
) {
  const transition = planTransition(previous, next);
  if (transition === "grant") await switchPlan(organizationId);
  else if (transition === "invalidate") invalidatePlanCache(organizationId);
  return transition;
}

// Customer ids are unique per organization; a legacy per-user customer stays on the first org that used it.
export async function linkCustomerToOrganization(organizationId: string, customerId: string) {
  const holder = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  if (holder) return;
  await prisma.organization.updateMany({
    where: { id: organizationId, stripeCustomerId: null },
    data: { stripeCustomerId: customerId },
  });
}

// Rows created before the organization backfill are attached to the subscriber's personal org.
export async function ensureSubscriptionOrganization(row: {
  id: string;
  userId: string;
  organizationId: string | null;
}): Promise<string> {
  if (row.organizationId) return row.organizationId;
  const organizationId = await prismaOrganizationRepository.ensurePersonalOrganization(row.userId);
  await prisma.subscription.update({ where: { id: row.id }, data: { organizationId } });
  return organizationId;
}
