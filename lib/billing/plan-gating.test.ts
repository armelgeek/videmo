import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureNotAvailableError, QuotaExceededError } from "./errors";
import {
  type PlanGatingDeps,
  type PlanWithLimits,
  PLAN_CACHE_TTL_MS,
  assertFeature,
  assertQuota,
  checkQuota,
  getOrgPlan,
  hasFeature,
  invalidatePlanCache,
} from "./plan-gating";

const FREE: PlanWithLimits = {
  id: "plan-free",
  name: "Free",
  tier: "free",
  quotas: [
    { key: "max_projects", value: 3 },
    { key: "monthly_credits", value: 50 },
  ],
  featureGates: [{ key: "remove_watermark", enabled: false }],
};

const PRO: PlanWithLimits = {
  id: "plan-pro",
  name: "Pro",
  tier: "pro",
  quotas: [{ key: "max_projects", value: -1 }],
  featureGates: [{ key: "remove_watermark", enabled: true }],
};

function deps(overrides: Partial<PlanGatingDeps> = {}): PlanGatingDeps {
  return {
    findPaidPlan: async () => null,
    findFreePlan: async () => FREE,
    now: () => 1_000,
    ...overrides,
  };
}

beforeEach(() => invalidatePlanCache());

describe("getOrgPlan", () => {
  it("falls back to Free without a paid subscription", async () => {
    const plan = await getOrgPlan("org-1", deps());
    expect(plan).toMatchObject({ tier: "free", isPaid: false });
  });

  it("uses the paid plan when there is one", async () => {
    const plan = await getOrgPlan("org-1", deps({ findPaidPlan: async () => PRO }));
    expect(plan).toMatchObject({ tier: "pro", isPaid: true });
  });

  it("fills keys missing in the database from the catalog", async () => {
    const plan = await getOrgPlan("org-1", deps());
    expect(plan.quotas.max_org_members).toBe(1);
    expect(plan.features.custom_branding).toBe(false);
  });

  it("fails loudly when no free plan is seeded", async () => {
    await expect(getOrgPlan("org-1", deps({ findFreePlan: async () => null }))).rejects.toThrow(
      /seed:plans/,
    );
  });

  it("serves from cache within the TTL, then refreshes", async () => {
    let now = 1_000;
    const findPaidPlan = vi.fn(async () => null);
    const d = deps({ findPaidPlan, now: () => now });

    await getOrgPlan("org-1", d);
    await getOrgPlan("org-1", d);
    expect(findPaidPlan).toHaveBeenCalledTimes(1);

    now += PLAN_CACHE_TTL_MS + 1;
    await getOrgPlan("org-1", d);
    expect(findPaidPlan).toHaveBeenCalledTimes(2);
  });

  it("refreshes immediately after invalidation", async () => {
    let paid: PlanWithLimits | null = null;
    const d = deps({ findPaidPlan: async () => paid });

    expect((await getOrgPlan("org-1", d)).tier).toBe("free");
    paid = PRO;
    invalidatePlanCache("org-1");
    expect((await getOrgPlan("org-1", d)).tier).toBe("pro");
  });
});

describe("features", () => {
  it("reads a gate", async () => {
    expect(await hasFeature("org-1", "remove_watermark", deps())).toBe(false);
  });

  it("throws with the current tier when denied", async () => {
    await expect(assertFeature("org-1", "remove_watermark", deps())).rejects.toMatchObject({
      constructor: FeatureNotAvailableError,
      tier: "free",
    });
  });
});

describe("quotas", () => {
  it("allows under the limit and reports what is left", async () => {
    expect(await checkQuota("org-1", "max_projects", 2, deps())).toEqual({
      allowed: true,
      limit: 3,
      current: 2,
      remaining: 1,
    });
  });

  it("refuses at the limit", async () => {
    await expect(assertQuota("org-1", "max_projects", 3, deps())).rejects.toBeInstanceOf(
      QuotaExceededError,
    );
  });

  it("never refuses an unlimited quota", async () => {
    const d = deps({ findPaidPlan: async () => PRO });
    expect((await checkQuota("org-1", "max_projects", 10_000, d)).allowed).toBe(true);
  });
});
