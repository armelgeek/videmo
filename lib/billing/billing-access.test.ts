import { describe, expect, it } from "vitest";
import { BillingAccessError, billingAccessMessage, canManageBilling } from "./billing-access";

describe("canManageBilling", () => {
  it("lets owners and admins manage billing", () => {
    expect(canManageBilling("owner")).toBe(true);
    expect(canManageBilling("admin")).toBe(true);
  });

  it("refuses members and missing roles", () => {
    expect(canManageBilling("member")).toBe(false);
    expect(canManageBilling(null)).toBe(false);
    expect(canManageBilling(undefined)).toBe(false);
  });
});

describe("billingAccessMessage", () => {
  it("explains a missing session", () => {
    expect(billingAccessMessage(new BillingAccessError("unauthenticated"))).toBe(
      "Authentication required",
    );
  });

  it("explains a role refusal", () => {
    expect(billingAccessMessage(new BillingAccessError("forbidden"))).toMatch(/owners and admins/);
  });
});
