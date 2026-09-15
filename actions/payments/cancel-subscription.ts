"use server";

import { headers } from "next/headers";
import {
  BillingAccessError,
  billingAccessMessage,
  requireBillingManager,
} from "@/lib/billing/billing-access";
import { stripe } from "@/lib/payments/stripe/config";
import { prisma } from "@/lib/prisma";
import { AuditEventType, auditLogger } from "@/lib/security/audit-logger";
import { getClientIdentifier } from "@/lib/security/rate-limiter";

export const cancelSubscription = async (subscriptionId: string) => {
  const clientIp = getClientIdentifier(await headers());

  try {
    const manager = await requireBillingManager();

    if (!subscriptionId || typeof subscriptionId !== "string") {
      return { error: "Invalid subscription" };
    }

    const subscription = await prisma.subscription.findFirst({
      where: { id: subscriptionId, organizationId: manager.organizationId },
    });

    if (!subscription) {
      auditLogger.logSecurity(
        AuditEventType.AUTHORIZATION_FAILED,
        "Subscription not found or access denied",
        {
          userId: manager.userId,
          email: manager.email,
          ipAddress: clientIp,
          metadata: { subscriptionId, organizationId: manager.organizationId },
        },
      );
      return { error: "Subscription not found" };
    }

    if (subscription.status === "canceled" || subscription.cancelAtPeriodEnd) {
      return { error: "Subscription already cancelled" };
    }

    await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      { cancel_at_period_end: true },
      { idempotencyKey: `cancel_${subscriptionId}_${Date.now()}` },
    );

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { cancelAtPeriodEnd: true },
    });

    auditLogger.logPayment(
      AuditEventType.SUBSCRIPTION_CANCELLED,
      "success",
      "Subscription cancelled at period end",
      {
        userId: manager.userId,
        email: manager.email,
        ipAddress: clientIp,
        resourceId: subscriptionId,
        metadata: {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          organizationId: manager.organizationId,
          currentPeriodEnd: subscription.currentPeriodEnd,
        },
      },
    );

    return { success: true };
  } catch (error) {
    if (error instanceof BillingAccessError) {
      auditLogger.logSecurity(
        error.reason === "forbidden"
          ? AuditEventType.AUTHORIZATION_FAILED
          : AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        "Subscription cancellation refused",
        { ipAddress: clientIp, metadata: { subscriptionId } },
      );
      return { error: billingAccessMessage(error) };
    }

    auditLogger.logPayment(
      AuditEventType.SUBSCRIPTION_CANCELLED,
      "failure",
      "Failed to cancel subscription",
      {
        ipAddress: clientIp,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { subscriptionId },
      },
    );
    return { error: "Unable to cancel subscription" };
  }
};
