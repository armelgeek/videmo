import type Stripe from "stripe";
import { EmailService } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";
import { AuditEventType, auditLogger } from "@/lib/security/audit-logger";
import {
  applyPlanTransition,
  ensureSubscriptionOrganization,
  subscriptionFields,
} from "./shared";

async function syncSubscription(subscription: Stripe.Subscription, statusOverride?: string) {
  const row = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { id: true, userId: true, planId: true, status: true, organizationId: true },
  });
  // The checkout handler creates the row; an update arriving first is replayed by Stripe later.
  if (!row) return null;

  const organizationId = await ensureSubscriptionOrganization(row);

  const priceId = subscription.items?.data[0]?.price?.id;
  const plan = priceId
    ? await prisma.plan.findUnique({ where: { stripePriceId: priceId }, select: { id: true } })
    : null;
  if (priceId && !plan) {
    auditLogger.logPayment(
      AuditEventType.SUBSCRIPTION_UPDATED,
      "warning",
      "Subscription moved to a price with no plan; keeping the previous plan",
      { resourceId: subscription.id, metadata: { priceId } },
    );
  }

  const fields = subscriptionFields(subscription);
  const status = statusOverride ?? fields.status;
  const planId = plan?.id ?? row.planId;

  await prisma.subscription.update({
    where: { id: row.id },
    data: { ...fields, status, planId },
  });

  const transition = await applyPlanTransition(
    organizationId,
    { planId: row.planId, status: row.status },
    { planId, status },
  );

  return { row, organizationId, status, planId, transition };
}

export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    const result = await syncSubscription(subscription);
    if (!result) {
      auditLogger.logPayment(
        AuditEventType.SUBSCRIPTION_UPDATED,
        "warning",
        "Subscription not found for update",
        { resourceId: subscription.id },
      );
      return;
    }

    auditLogger.logPayment(AuditEventType.SUBSCRIPTION_UPDATED, "success", "Subscription updated", {
      userId: result.row.userId,
      resourceId: subscription.id,
      metadata: {
        status: result.status,
        planId: result.planId,
        organizationId: result.organizationId,
        transition: result.transition,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    auditLogger.logPayment(
      AuditEventType.SUBSCRIPTION_UPDATED,
      "failure",
      "Failed to update subscription",
      {
        resourceId: subscription.id,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );
    throw error;
  }
}

export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  try {
    const result = await syncSubscription(subscription, "canceled");
    if (!result) {
      auditLogger.logPayment(
        AuditEventType.SUBSCRIPTION_DELETED,
        "warning",
        "Subscription not found for deletion",
        { resourceId: subscription.id },
      );
      return;
    }

    auditLogger.logPayment(AuditEventType.SUBSCRIPTION_DELETED, "success", "Subscription deleted", {
      userId: result.row.userId,
      resourceId: subscription.id,
      metadata: { organizationId: result.organizationId, transition: result.transition },
    });

    // A replayed deletion must not email the customer twice.
    if (result.row.status !== "canceled") await sendCancellationEmail(result.row.userId);
  } catch (error) {
    auditLogger.logPayment(
      AuditEventType.SUBSCRIPTION_DELETED,
      "failure",
      "Failed to delete subscription",
      {
        resourceId: subscription.id,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );
    throw error;
  }
}

async function sendCancellationEmail(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return;
    await new EmailService().sendEmail({
      recipients: [user.email],
      type: "subscription_cancelled",
      data: {
        recipientEmail: user.email,
        recipientName: user.name || user.email.split("@")[0],
      },
    });
  } catch (emailError) {
    console.error("Failed to send subscription cancellation email:", emailError);
  }
}
