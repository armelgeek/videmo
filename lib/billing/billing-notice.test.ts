import { describe, expect, it } from "vitest";
import { billingNoticeFor, creditLevel } from "./billing-notice";

describe("billingNoticeFor", () => {
  it("offers to buy credits on 402 insufficient_credits", () => {
    expect(
      billingNoticeFor(402, { code: "insufficient_credits", error: "This needs 8 credits" }),
    ).toEqual({ message: "This needs 8 credits", actionLabel: "Buy credits", href: "/billing?topup=open" });
  });

  it("offers an upgrade on 403 quota_exceeded and feature_unavailable", () => {
    expect(billingNoticeFor(403, { code: "quota_exceeded", error: "Limit" })?.actionLabel).toBe(
      "Upgrade",
    );
    expect(billingNoticeFor(403, { code: "feature_unavailable" })?.message).toBe(
      "Not available on your plan",
    );
  });

  it("ignores other errors so callers keep their own handling", () => {
    expect(billingNoticeFor(403, { error: "Forbidden" })).toBeNull();
    expect(billingNoticeFor(402, { code: "quota_exceeded" })).toBeNull();
    expect(billingNoticeFor(500, { code: "insufficient_credits" })).toBeNull();
    expect(billingNoticeFor(402, null)).toBeNull();
    expect(billingNoticeFor(402, "text")).toBeNull();
  });
});

describe("creditLevel", () => {
  it("warns under a fifth of the allowance", () => {
    expect(creditLevel(199, 1000)).toBe("low");
    expect(creditLevel(200, 1000)).toBe("ok");
  });

  it("handles a plan without allowance", () => {
    expect(creditLevel(10, 0)).toBe("ok");
    expect(creditLevel(0, 0)).toBe("low");
  });
});
