"use server";

import { headers } from "next/headers";
import {
  BillingAccessError,
  billingAccessMessage,
  requireBillingManager,
} from "@/lib/billing/billing-access";
import { stripe } from "@/lib/payments/stripe/config";
import { createOrRetrieveOrganizationCustomer } from "@/lib/payments/stripe/utils";
import { prisma } from "@/lib/prisma";
import { AuditEventType, auditLogger } from "@/lib/security/audit-logger";
import { getClientIdentifier } from "@/lib/security/rate-limiter";

// A subscription in dunning still counts: a second checkout would bill the organization twice.
const BLOCKING_STATUSES = ["active", "trialing", "past_due", "unpaid"];

export const createCheckoutSession = async (planId: string) => {
  const clientIp = getClientIdentifier(await headers());

  try {
    const manager = await requireBillingManager();

    if (!planId || typeof planId !== "string") {
      return { error: "Invalid plan" };
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive || plan.tier === "free") {
      auditLogger.logPayment(
        AuditEventType.CHECKOUT_SESSION_FAILED,
        "failure",
        "Invalid, inactive or free plan",
        {
          userId: manager.userId,
          email: manager.email,
          ipAddress: clientIp,
          metadata: { planId, planFound: !!plan, planActive: plan?.isActive, tier: plan?.tier },
        },
      );
      return { error: "Plan not available" };
    }

    const existing = await prisma.subscription.findFirst({
      where: { organizationId: manager.organizationId, status: { in: BLOCKING_STATUSES } },
      select: { id: true },
    });
    if (existing) {
      return {
        error: "This organization already has a subscription. Change plans from the billing portal.",
      };
    }

    const customerId = await createOrRetrieveOrganizationCustomer(manager);
    const metadata = {
      userId: manager.userId,
      planId: plan.id,
      organizationId: manager.organizationId,
    };

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        customer: customerId,
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: plan.stripePriceId, quantity: 1 }],
        success_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payment/cancel?from=checkout`,
        metadata,
        subscription_data: { metadata },
      },
      { idempotencyKey: `checkout_${manager.organizationId}_${plan.id}_${Date.now()}` },
    );

    auditLogger.logPayment(
      AuditEventType.CHECKOUT_SESSION_CREATED,
      "success",
      "Checkout session created successfully",
      {
        userId: manager.userId,
        email: manager.email,
        ipAddress: clientIp,
        resourceId: checkoutSession.id,
        metadata: {
          planId: plan.id,
          planName: plan.name,
          organizationId: manager.organizationId,
          amount: plan.amount,
          currency: plan.currency,
        },
      },
    );

    return { url: checkoutSession.url };
  } catch (error) {
    if (error instanceof BillingAccessError) {
      auditLogger.logSecurity(
        error.reason === "forbidden"
          ? AuditEventType.AUTHORIZATION_FAILED
          : AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        "Checkout session refused",
        { ipAddress: clientIp, metadata: { planId } },
      );
      return { error: billingAccessMessage(error) };
    }

    auditLogger.logPayment(
      AuditEventType.CHECKOUT_SESSION_FAILED,
      "failure",
      "Failed to create checkout session",
      {
        ipAddress: clientIp,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { planId },
      },
    );
    return { error: "Unable to process request" };
  }
};
