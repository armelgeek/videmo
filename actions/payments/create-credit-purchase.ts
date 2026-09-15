"use server";

import { headers } from "next/headers";
import {
  BillingAccessError,
  billingAccessMessage,
  requireBillingManager,
} from "@/lib/billing/billing-access";
import { findCreditPack } from "@/lib/billing/catalog";
import { stripe } from "@/lib/payments/stripe/config";
import { createOrRetrieveOrganizationCustomer } from "@/lib/payments/stripe/utils";
import { AuditEventType, auditLogger } from "@/lib/security/audit-logger";
import { getClientIdentifier } from "@/lib/security/rate-limiter";

export const createCreditPurchaseCheckout = async (packId: string) => {
  const clientIp = getClientIdentifier(await headers());

  try {
    const manager = await requireBillingManager();

    const pack = findCreditPack(packId);
    if (!pack) return { error: "Invalid credit pack" };

    const customerId = await createOrRetrieveOrganizationCustomer(manager);

    // Read back by the webhook, which re-validates credits and amount against the catalog.
    const metadata = {
      type: "credit_topup",
      userId: manager.userId,
      organizationId: manager.organizationId,
      packId: pack.id,
      credits: String(pack.credits),
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: pack.label,
              description: `${pack.credits} credits for ${manager.organizationName}`,
            },
            unit_amount: pack.amount,
          },
          quantity: 1,
        },
      ],
      metadata,
      payment_intent_data: { metadata },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?topup=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?topup=cancel`,
    });

    auditLogger.logPayment(
      AuditEventType.CHECKOUT_SESSION_CREATED,
      "success",
      "Credit top-up checkout session created",
      {
        userId: manager.userId,
        email: manager.email,
        ipAddress: clientIp,
        resourceId: checkoutSession.id,
        metadata: { organizationId: manager.organizationId, packId: pack.id },
      },
    );

    return { url: checkoutSession.url };
  } catch (error) {
    if (error instanceof BillingAccessError) {
      auditLogger.logSecurity(
        error.reason === "forbidden"
          ? AuditEventType.AUTHORIZATION_FAILED
          : AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        "Credit top-up checkout refused",
        { ipAddress: clientIp, metadata: { packId } },
      );
      return { error: billingAccessMessage(error) };
    }

    auditLogger.logPayment(
      AuditEventType.CHECKOUT_SESSION_FAILED,
      "failure",
      "Failed to create credit top-up checkout session",
      {
        ipAddress: clientIp,
        error: error instanceof Error ? error : new Error(String(error)),
        metadata: { packId },
      },
    );
    return { error: "Unable to process request" };
  }
};
