import { describe, expect, it } from "vitest";
import { PaymentValidationError, planTransition, validateTopupSession } from "./stripe-rules";

const PRO = "plan-pro";
const STARTER = "plan-starter";

describe("planTransition", () => {
  it("grants on a new paid subscription", () => {
    expect(planTransition(null, { planId: PRO, status: "active" })).toBe("grant");
  });

  it("does nothing when a replayed event changes nothing", () => {
    expect(planTransition({ planId: PRO, status: "active" }, { planId: PRO, status: "active" })).toBe(
      "none",
    );
  });

  it("grants when the plan changes while paid", () => {
    expect(
      planTransition({ planId: STARTER, status: "active" }, { planId: PRO, status: "active" }),
    ).toBe("grant");
  });

  it("only invalidates when a trial converts on the same plan", () => {
    expect(
      planTransition({ planId: PRO, status: "trialing" }, { planId: PRO, status: "active" }),
    ).toBe("invalidate");
  });

  it("does not refill credits when recovering from past_due", () => {
    expect(
      planTransition({ planId: PRO, status: "past_due" }, { planId: PRO, status: "active" }),
    ).toBe("invalidate");
  });

  it("grants when the first payment completes an incomplete subscription", () => {
    expect(
      planTransition({ planId: PRO, status: "incomplete" }, { planId: PRO, status: "active" }),
    ).toBe("grant");
  });

  it("only invalidates when a payment fails", () => {
    expect(
      planTransition({ planId: PRO, status: "active" }, { planId: PRO, status: "past_due" }),
    ).toBe("invalidate");
  });

  it("grants Free credits when a paid subscription is canceled", () => {
    expect(
      planTransition({ planId: PRO, status: "active" }, { planId: PRO, status: "canceled" }),
    ).toBe("grant");
  });

  it("grants Free credits when a dunning subscription is canceled", () => {
    expect(
      planTransition({ planId: PRO, status: "unpaid" }, { planId: PRO, status: "canceled" }),
    ).toBe("grant");
  });

  it("does not refill Free credits when a never-paid subscription expires", () => {
    expect(
      planTransition(
        { planId: PRO, status: "incomplete" },
        { planId: PRO, status: "incomplete_expired" },
      ),
    ).toBe("invalidate");
  });

  it("does nothing on a replayed cancellation", () => {
    expect(
      planTransition({ planId: PRO, status: "canceled" }, { planId: PRO, status: "canceled" }),
    ).toBe("none");
  });
});

const PAID_TOPUP = {
  id: "cs_1",
  mode: "payment" as const,
  payment_status: "paid" as const,
  amount_total: 1299,
  currency: "usd",
  payment_intent: "pi_1",
  metadata: {
    type: "credit_topup",
    packId: "medium",
    credits: "300",
    organizationId: "org-1",
    userId: "u1",
  },
};

describe("validateTopupSession", () => {
  it("returns the grant for a valid paid top-up", () => {
    expect(validateTopupSession(PAID_TOPUP)).toEqual({
      organizationId: "org-1",
      userId: "u1",
      stripePaymentId: "pi_1",
      packId: "medium",
      credits: 300,
      amount: 1299,
      currency: "usd",
    });
  });

  it("reads an expanded payment intent", () => {
    const session = { ...PAID_TOPUP, payment_intent: { id: "pi_2" } as never };
    expect(validateTopupSession(session).stripePaymentId).toBe("pi_2");
  });

  const refusals: [string, object][] = [
    ["an unpaid session", { payment_status: "unpaid" }],
    ["a subscription session", { mode: "subscription" }],
    ["an unknown pack", { metadata: { ...PAID_TOPUP.metadata, packId: "huge" } }],
    ["a prototype key as pack", { metadata: { ...PAID_TOPUP.metadata, packId: "toString" } }],
    ["tampered credits", { metadata: { ...PAID_TOPUP.metadata, credits: "3000" } }],
    ["a wrong amount", { amount_total: 1 }],
    ["another currency", { currency: "eur" }],
    ["no payment intent", { payment_intent: null }],
    ["no organization", { metadata: { ...PAID_TOPUP.metadata, organizationId: "" } }],
  ];

  for (const [label, override] of refusals) {
    it(`refuses ${label}`, () => {
      expect(() => validateTopupSession({ ...PAID_TOPUP, ...override } as never)).toThrow(
        PaymentValidationError,
      );
    });
  }
});
