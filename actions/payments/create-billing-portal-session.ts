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

export const createBillingPortalSession = async () => {
  const clientIp = getClientIdentifier(await headers());

  try {
    const manager = await requireBillingManager();

    const organization = await prisma.organization.findUnique({
      where: { id: manager.organizationId },
      select: { stripeCustomerId: true },
    });

    if (!organization?.stripeCustomerId) {
      auditLogger.logPayment(
        AuditEventType.BILLING_PORTAL_ACCESSED,
        "failure",
        "No billing information found",
        {
          userId: manager.userId,
          email: manager.email,
          ipAddress: clientIp,
          metadata: { organizationId: manager.organizationId },
        },
      );
      return { error: "No billing information available" };
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    });

    auditLogger.logPayment(
      AuditEventType.BILLING_PORTAL_ACCESSED,
      "success",
      "Billing portal session created",
      {
        userId: manager.userId,
        email: manager.email,
        ipAddress: clientIp,
        resourceId: portalSession.id,
        metadata: {
          customerId: organization.stripeCustomerId,
          organizationId: manager.organizationId,
        },
      },
    );

    return { url: portalSession.url };
  } catch (error) {
    if (error instanceof BillingAccessError) {
      auditLogger.logSecurity(
        error.reason === "forbidden"
          ? AuditEventType.AUTHORIZATION_FAILED
          : AuditEventType.UNAUTHORIZED_ACCESS_ATTEMPT,
        "Billing portal access refused",
        { ipAddress: clientIp },
      );
      return { error: billingAccessMessage(error) };
    }

    auditLogger.logPayment(
      AuditEventType.BILLING_PORTAL_ACCESSED,
      "failure",
      "Failed to create billing portal session",
      {
        ipAddress: clientIp,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );
    return { error: "Unable to access billing portal" };
  }
};
