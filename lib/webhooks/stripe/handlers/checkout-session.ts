import type Stripe from "stripe";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import { grantPurchasedCredits } from "@/lib/billing/credit-service";
import { PaymentValidationError, validateTopupSession } from "@/lib/billing/stripe-rules";
import { EmailService } from "@/lib/email-service";
import { stripe } from "@/lib/payments/stripe/config";
import { prisma } from "@/lib/prisma";
import { AuditEventType, auditLogger } from "@/lib/security/audit-logger";
import {
  applyPlanTransition,
  linkCustomerToOrganization,
  stripeId,
  subscriptionFields,
} from "./shared";

export type RetrieveSubscription = (id: string) => Promise<Stripe.Subscription>;

const retrieveFromStripe: RetrieveSubscription = (id) => stripe.subscriptions.retrieve(id);

export type CheckoutSyncResult =
  | { kind: "topup"; applied: boolean }
  | { kind: "subscription"; created: boolean }
  | { kind: "ignored"; reason: string };

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  retrieveSubscription: RetrieveSubscription = retrieveFromStripe,
): Promise<CheckoutSyncResult> {
  if (session.mode === "payment") return handleTopup(session);
  if (session.mode === "subscription") {
    return handleSubscriptionCheckout(session, retrieveSubscription);
  }
  return { kind: "ignored", reason: `Unsupported checkout mode ${session.mode}` };
}

async function handleTopup(session: Stripe.Checkout.Session): Promise<CheckoutSyncResult> {
  if (session.metadata?.type !== "credit_topup") {
    return { kind: "ignored", reason: "Payment session is not a credit top-up" };
  }

  let grant: ReturnType<typeof validateTopupSession>;
  try {
    grant = validateTopupSession(session);
  } catch (error) {
    if (error instanceof PaymentValidationError) {
      auditLogger.logPayment(AuditEventType.PAYMENT_VALIDATION_FAILED, "failure", error.message, {
        userId: session.metadata?.userId,
        resourceId: session.id,
        metadata: error.details,
      });
    }
    throw error;
  }

  const transaction = await grantPurchasedCredits(grant);
  auditLogger.logPayment(
    AuditEventType.PAYMENT_SUCCEEDED,
    "success",
    transaction ? "Credit top-up granted" : "Credit top-up already granted",
    {
      userId: grant.userId ?? undefined,
      resourceId: grant.stripePaymentId,
      metadata: {
        organizationId: grant.organizationId,
        packId: grant.packId,
        credits: grant.credits,
      },
    },
  );
  return { kind: "topup", applied: transaction !== null };
}

async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  retrieveSubscription: RetrieveSubscription,
): Promise<CheckoutSyncResult> {
  const subscriptionId = stripeId(session.subscription);
  const customerId = stripeId(session.customer);
  const userId = session.metadata?.userId;
  const planId = session.metadata?.planId;

  auditLogger.logPayment(
    AuditEventType.CHECKOUT_SESSION_COMPLETED,
    "success",
    "Processing checkout session completed",
    { userId, resourceId: session.id, metadata: { subscriptionId, customerId, planId } },
  );

  if (!userId || !planId || !subscriptionId || !customerId) {
    auditLogger.logPayment(
      AuditEventType.CHECKOUT_SESSION_FAILED,
      "failure",
      "Checkout session is missing metadata, customer or subscription",
      {
        resourceId: session.id,
        metadata: {
          hasUserId: !!userId,
          hasPlanId: !!planId,
          hasSubscription: !!subscriptionId,
          hasCustomer: !!customerId,
        },
      },
    );
    return { kind: "ignored", reason: "Incomplete checkout session" };
  }

  const reject = (message: string, metadata: Record<string, unknown>) => {
    auditLogger.logPayment(AuditEventType.PAYMENT_VALIDATION_FAILED, "failure", message, {
      userId,
      resourceId: session.id,
      metadata,
    });
    return new PaymentValidationError(message, metadata);
  };

  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw reject("Plan not found for checkout session", { planId });
    if (plan.tier === "free") throw reject("The free plan cannot be purchased", { planId });
    if (session.currency !== plan.currency) {
      throw reject("Currency mismatch in checkout session", {
        expected: plan.currency,
        received: session.currency,
      });
    }
    if (session.amount_total !== plan.amount) {
      throw reject("Amount mismatch in checkout session", {
        expected: plan.amount,
        received: session.amount_total,
      });
    }

    const organizationId =
      session.metadata?.organizationId ||
      (await prismaOrganizationRepository.ensurePersonalOrganization(userId));

    const [organization, user] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { stripeCustomerId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, email: true, name: true },
      }),
    ]);
    if (!organization) throw reject("Organization not found", { organizationId });

    const expectedCustomer = organization.stripeCustomerId ?? user?.stripeCustomerId;
    if (expectedCustomer && expectedCustomer !== customerId) {
      throw reject("Customer ID mismatch in checkout session", {
        expected: expectedCustomer,
        received: customerId,
      });
    }

    const subscription = await retrieveSubscription(subscriptionId);
    const price = subscription.items.data[0]?.price;
    if (price?.id !== plan.stripePriceId) {
      throw reject("Price mismatch in checkout session", {
        expected: plan.stripePriceId,
        received: price?.id ?? null,
      });
    }
    if (price.recurring?.interval !== plan.interval) {
      throw reject("Subscription interval mismatch in checkout session", {
        expected: plan.interval,
        received: price.recurring?.interval ?? null,
      });
    }

    const previous = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      select: { planId: true, status: true },
    });

    const fields = subscriptionFields(subscription);
    const saved = await prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      update: { ...fields, planId, organizationId },
      create: {
        ...fields,
        userId,
        planId,
        organizationId,
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
      },
    });

    await linkCustomerToOrganization(organizationId, customerId);
    const transition = await applyPlanTransition(organizationId, previous, {
      planId,
      status: saved.status,
    });

    auditLogger.logPayment(
      previous ? AuditEventType.SUBSCRIPTION_UPDATED : AuditEventType.SUBSCRIPTION_CREATED,
      "success",
      previous ? "Subscription already recorded" : "Subscription created successfully",
      {
        userId,
        resourceId: saved.id,
        metadata: { stripeSubscriptionId: subscriptionId, planId, organizationId, transition },
      },
    );

    if (!previous) {
      await recordCheckoutPayment(session, userId, plan.name);
      if (user) await sendSubscriptionEmail(user, plan.name, fields.currentPeriodEnd);
    }

    return { kind: "subscription", created: !previous };
  } catch (error) {
    auditLogger.logPayment(
      AuditEventType.CHECKOUT_SESSION_FAILED,
      "failure",
      "Error in handleCheckoutSessionCompleted",
      {
        userId,
        resourceId: session.id,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );
    throw error;
  }
}

async function recordCheckoutPayment(
  session: Stripe.Checkout.Session,
  userId: string,
  planName: string,
) {
  const paymentId = stripeId(session.payment_intent);
  if (!paymentId || session.amount_total === null) return;

  await prisma.payment.upsert({
    where: { stripePaymentId: paymentId },
    update: {},
    create: {
      userId,
      stripePaymentId: paymentId,
      amount: session.amount_total,
      currency: session.currency ?? "usd",
      status: "succeeded",
      description: `Subscription payment for plan ${planName}`,
    },
  });
}

async function sendSubscriptionEmail(
  user: { email: string; name: string | null },
  planName: string,
  currentPeriodEnd: Date,
) {
  try {
    await new EmailService().sendEmail({
      recipients: [user.email],
      type: "subscription_created",
      data: {
        recipientEmail: user.email,
        recipientName: user.name || user.email.split("@")[0],
        planName,
        currentPeriodEnd: currentPeriodEnd.toLocaleDateString(),
      },
    });
  } catch (emailError) {
    console.error("Failed to send subscription confirmation email:", emailError);
  }
}
