"use server";

import {
  BillingAccessError,
  billingAccessMessage,
  getBillingViewer,
} from "@/lib/billing/billing-access";
import { prisma } from "@/lib/prisma";

// Dunning subscriptions stay visible so a manager can fix the payment method.
const VISIBLE_STATUSES = ["active", "trialing", "past_due", "unpaid"];

export const getUserSubscription = async () => {
  try {
    const viewer = await getBillingViewer();

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: viewer.organizationId, status: { in: VISIBLE_STATUSES } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    return { subscription, canManage: viewer.canManage };
  } catch (error) {
    if (error instanceof BillingAccessError) {
      return { error: billingAccessMessage(error) };
    }
    console.error("Error fetching subscription:", error);
    return { error: "Failed to fetch subscription" };
  }
};
