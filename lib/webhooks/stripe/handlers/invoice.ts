import type Stripe from "stripe";
import { EmailService } from "@/lib/email-service";
import { prisma } from "@/lib/prisma";
import { AuditEventType, auditLogger } from "@/lib/security/audit-logger";
import { applyPlanTransition, ensureSubscriptionOrganization, stripeId } from "./shared";

const RECOVERABLE_STATUSES = ["past_due", "unpaid"];

function findSubscriptionRow(invoice: Stripe.Invoice) {
  const subscriptionId = stripeId(invoice.subscription);
  if (!subscriptionId) return null;
  return prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true, userId: true, planId: true, status: true, organizationId: true },
  });
}

export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;
    const row = await findSubscriptionRow(invoice);
    if (!row) {
      auditLogger.logPayment(
        AuditEventType.PAYMENT_SUCCEEDED,
        "warning",
        "Subscription not found for invoice payment",
        { resourceId: invoice.id, metadata: { subscriptionId: stripeId(invoice.subscription) } },
      );
      return;
    }

    if (RECOVERABLE_STATUSES.includes(row.status)) {
      await prisma.subscription.update({ where: { id: row.id }, data: { status: "active" } });
      const organizationId = await ensureSubscriptionOrganization(row);
      await applyPlanTransition(
        organizationId,
        { planId: row.planId, status: row.status },
        { planId: row.planId, status: "active" },
      );
    }

    const paymentId = stripeId(invoice.payment_intent);
    if (!paymentId || invoice.amount_paid <= 0) return;

    const existing = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentId },
      select: { id: true },
    });
    if (existing) return;

    const description = `Invoice payment for subscription ${row.id}`;
    await prisma.payment.create({
      data: {
        userId: row.userId,
        stripePaymentId: paymentId,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: "succeeded",
        description,
      },
    });

    auditLogger.logPayment(AuditEventType.PAYMENT_SUCCEEDED, "success", "Invoice payment recorded", {
      userId: row.userId,
      resourceId: paymentId,
      metadata: { amount: invoice.amount_paid, currency: invoice.currency, invoiceId: invoice.id },
    });

    await sendReceipt(row.userId, invoice, paymentId, description);
  } catch (error) {
    auditLogger.logPayment(
      AuditEventType.PAYMENT_FAILED,
      "failure",
      "Failed to record invoice payment",
      {
        resourceId: invoice.id,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );
    throw error;
  }
}

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    if (!invoice.subscription) return;
    const row = await findSubscriptionRow(invoice);
    if (!row) {
      auditLogger.logPayment(
        AuditEventType.PAYMENT_FAILED,
        "warning",
        "Subscription not found for failed invoice",
        { resourceId: invoice.id, metadata: { subscriptionId: stripeId(invoice.subscription) } },
      );
      return;
    }

    if (row.status !== "past_due") {
      await prisma.subscription.update({ where: { id: row.id }, data: { status: "past_due" } });
      const organizationId = await ensureSubscriptionOrganization(row);
      await applyPlanTransition(
        organizationId,
        { planId: row.planId, status: row.status },
        { planId: row.planId, status: "past_due" },
      );
    }

    auditLogger.logPayment(AuditEventType.PAYMENT_FAILED, "failure", "Invoice payment failed", {
      userId: row.userId,
      resourceId: invoice.id,
      metadata: { amount: invoice.amount_due, currency: invoice.currency, subscriptionId: row.id },
    });
  } catch (error) {
    auditLogger.logPayment(
      AuditEventType.PAYMENT_FAILED,
      "failure",
      "Failed to process failed invoice",
      {
        resourceId: invoice.id,
        error: error instanceof Error ? error : new Error(String(error)),
      },
    );
    throw error;
  }
}

async function sendReceipt(
  userId: string,
  invoice: Stripe.Invoice,
  paymentId: string,
  description: string,
) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return;
    await new EmailService().sendEmail({
      recipients: [user.email],
      type: "payment_receipt",
      data: {
        recipientEmail: user.email,
        recipientName: user.name || user.email.split("@")[0],
        invoiceId: paymentId,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency.toUpperCase(),
        paymentDate: new Date().toLocaleDateString(),
        description,
      },
    });
  } catch (emailError) {
    console.error("Failed to send payment receipt email:", emailError);
  }
}
