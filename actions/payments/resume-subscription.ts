"use server";

import {
  BillingAccessError,
  billingAccessMessage,
  requireBillingManager,
} from "@/lib/billing/billing-access";
import { stripe } from "@/lib/payments/stripe/config";
import { prisma } from "@/lib/prisma";

export const resumeSubscription = async (subscriptionId: string) => {
  try {
    const manager = await requireBillingManager();

    if (!subscriptionId || typeof subscriptionId !== "string") {
      return { error: "Invalid subscription" };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId: manager.organizationId },
    });

    if (!subscription) {
      return { error: "Subscription not found" };
    }
    if (subscription.status === "canceled") {
      return { error: "A canceled subscription cannot be resumed" };
    }
    if (!subscription.cancelAtPeriodEnd) {
      return { error: "Subscription is not scheduled to cancel" };
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAtPeriodEnd: false },
    });

    return { success: true };
  } catch (error) {
    if (error instanceof BillingAccessError) {
      return { error: billingAccessMessage(error) };
    }
    console.error("Error resuming subscription:", error);
    return { error: "Failed to resume subscription" };
  }
};
