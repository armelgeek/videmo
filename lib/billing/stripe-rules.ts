import type Stripe from "stripe";
import { CREDIT_PACKS, type CreditPackId } from "./catalog";
import { isPaidStatus } from "./wallet-policy";

export class PaymentValidationError extends Error {
  constructor(
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PaymentValidationError";
  }
}

export interface SubscriptionState {
  planId: string;
  status: string;
}

export type PlanTransition = "grant" | "invalidate" | "none";

const TERMINAL_STATUSES = ["canceled", "incomplete_expired"];
const DUNNING_STATUSES = ["past_due", "unpaid", "paused"];

/**
 * "grant" resets the organization's plan credits to its current allowance.
 * Recovering from dunning on the same plan must not refill credits, and a
 * subscription that never got paid must not refill Free credits when it expires.
 */
export function planTransition(
  previous: SubscriptionState | null,
  next: SubscriptionState,
): PlanTransition {
  const unchanged = previous?.status === next.status && previous.planId === next.planId;

  if (isPaidStatus(next.status)) {
    if (!previous || previous.planId !== next.planId) return "grant";
    if (isPaidStatus(previous.status) || DUNNING_STATUSES.includes(previous.status)) {
      return unchanged ? "none" : "invalidate";
    }
    return "grant";
  }

  if (TERMINAL_STATUSES.includes(next.status)) {
    if (unchanged) return "none";
    const hadBeenPaid =
      previous !== null &&
      (isPaidStatus(previous.status) || DUNNING_STATUSES.includes(previous.status));
    return hadBeenPaid ? "grant" : "invalidate";
  }

  return unchanged ? "none" : "invalidate";
}

export interface TopupGrant {
  organizationId: string;
  userId: string | null;
  stripePaymentId: string;
  packId: CreditPackId;
  credits: number;
  amount: number;
  currency: string;
}

type TopupSession = Pick<
  Stripe.Checkout.Session,
  "id" | "mode" | "metadata" | "payment_status" | "amount_total" | "currency" | "payment_intent"
>;

export function validateTopupSession(session: TopupSession): TopupGrant {
  const metadata = session.metadata ?? {};
  if (session.mode !== "payment" || metadata.type !== "credit_topup") {
    throw new PaymentValidationError("Not a credit top-up session", { mode: session.mode });
  }
  if (session.payment_status !== "paid") {
    throw new PaymentValidationError("Top-up is not paid", {
      paymentStatus: session.payment_status,
    });
  }

  const packId = metadata.packId;
  if (!packId || !Object.hasOwn(CREDIT_PACKS, packId)) {
    throw new PaymentValidationError("Unknown credit pack", { packId });
  }
  const pack = CREDIT_PACKS[packId as CreditPackId];

  if (metadata.credits !== String(pack.credits)) {
    throw new PaymentValidationError("Credit count does not match the pack", {
      expected: pack.credits,
      received: metadata.credits,
    });
  }
  if (session.amount_total !== pack.amount) {
    throw new PaymentValidationError("Amount does not match the pack", {
      expected: pack.amount,
      received: session.amount_total,
    });
  }
  if (session.currency !== "usd") {
    throw new PaymentValidationError("Unexpected currency", { received: session.currency });
  }

  const stripePaymentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!stripePaymentId) {
    throw new PaymentValidationError("Top-up has no payment intent", { sessionId: session.id });
  }
  if (!metadata.organizationId) {
    throw new PaymentValidationError("Top-up has no organization", { sessionId: session.id });
  }

  return {
    organizationId: metadata.organizationId,
    userId: metadata.userId || null,
    stripePaymentId,
    packId: packId as CreditPackId,
    credits: pack.credits,
    amount: pack.amount,
    currency: session.currency,
  };
}
