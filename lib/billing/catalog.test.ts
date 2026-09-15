import { describe, expect, it } from "vitest";
import {
  CREDIT_ACTION_COSTS,
  CREDIT_PACKS,
  FEATURE_KEYS,
  FREE_PRICE_ID,
  QUOTA_KEYS,
  TIER_CATALOG,
  TIERS,
  findCreditPack,
  getTierDefinition,
  placeholderPriceId,
} from "./catalog";

describe("tier catalog", () => {
  it("defines every tier exactly once", () => {
    expect(TIER_CATALOG.map((t) => t.tier)).toEqual([...TIERS]);
  });

  it("gives every tier every quota and feature key", () => {
    for (const definition of TIER_CATALOG) {
      expect(Object.keys(definition.quotas).sort()).toEqual([...QUOTA_KEYS].sort());
      expect(Object.keys(definition.features).sort()).toEqual([...FEATURE_KEYS].sort());
    }
  });

  it("keeps Free monthly-only at zero cost", () => {
    expect(getTierDefinition("free")?.prices).toEqual({ month: 0 });
  });

  it("prices every paid tier monthly and yearly", () => {
    for (const definition of TIER_CATALOG.filter((t) => t.tier !== "free")) {
      expect(definition.prices.month).toBeGreaterThan(0);
      expect(definition.prices.year).toBeGreaterThan(0);
    }
  });

  it("lets every tier have at least its owner as member", () => {
    for (const definition of TIER_CATALOG) {
      const members = definition.quotas.max_org_members;
      expect(members === -1 || members >= 1).toBe(true);
    }
  });

  it("never lowers monthly credits on a higher tier", () => {
    const credits = TIER_CATALOG.map((t) => t.quotas.monthly_credits);
    expect([...credits].sort((a, b) => a - b)).toEqual(credits);
  });
});

describe("credit costs and packs", () => {
  it("has unique actions with positive costs", () => {
    const actions = CREDIT_ACTION_COSTS.map((c) => c.action);
    expect(new Set(actions).size).toBe(actions.length);
    for (const { cost } of CREDIT_ACTION_COSTS) expect(cost).toBeGreaterThan(0);
  });

  it("has positive packs", () => {
    for (const pack of Object.values(CREDIT_PACKS)) {
      expect(pack.credits).toBeGreaterThan(0);
      expect(pack.amount).toBeGreaterThan(0);
    }
  });
});

describe("findCreditPack", () => {
  it("returns a known pack with its id", () => {
    expect(findCreditPack("medium")).toEqual({ id: "medium", ...CREDIT_PACKS.medium });
  });

  it("rejects unknown, prototype and non-string ids", () => {
    expect(findCreditPack("huge")).toBeNull();
    expect(findCreditPack("toString")).toBeNull();
    expect(findCreditPack(42)).toBeNull();
  });
});

describe("placeholderPriceId", () => {
  it("uses the shared Free id", () => {
    expect(placeholderPriceId("free", "month")).toBe(FREE_PRICE_ID);
  });

  it("is distinct per paid tier and interval", () => {
    expect(placeholderPriceId("pro", "month")).not.toBe(placeholderPriceId("pro", "year"));
  });
});
