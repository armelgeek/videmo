import { describe, expect, it } from "vitest";
import { UNLIMITED } from "./catalog";
import { type UserPlanDeps, getUserPlan } from "./user-plan";

const freePlan = { tier: "free", quotas: [{ key: "max_organizations", value: 1 }] };

function deps(overrides: Partial<UserPlanDeps> = {}): UserPlanDeps {
  return {
    findPaidTiers: async () => [],
    findFreePlan: async () => freePlan,
    ...overrides,
  };
}

describe("getUserPlan", () => {
  it("falls back to the free plan when the user has no paid subscription", async () => {
    const plan = await getUserPlan("user_1", deps());
    expect(plan).toMatchObject({ tier: "free", isPaid: false });
    expect(plan.quotas.max_organizations).toBe(1);
  });

  it("keeps the highest tier when the user holds several subscriptions", async () => {
    const plan = await getUserPlan(
      "user_1",
      deps({
        findPaidTiers: async () => [
          { tier: "starter", quotas: [{ key: "max_organizations", value: 1 }] },
          { tier: "pro", quotas: [{ key: "max_organizations", value: 3 }] },
        ],
      }),
    );
    expect(plan).toMatchObject({ tier: "pro", isPaid: true });
    expect(plan.quotas.max_organizations).toBe(3);
  });

  it("fills quota keys missing from the database from the catalog", async () => {
    const plan = await getUserPlan(
      "user_1",
      deps({ findPaidTiers: async () => [{ tier: "enterprise", quotas: [] }] }),
    );
    expect(plan.quotas.max_organizations).toBe(UNLIMITED);
  });

  it("throws when no free plan is seeded", async () => {
    await expect(getUserPlan("user_1", deps({ findFreePlan: async () => null }))).rejects.toThrow(
      /seed:plans/,
    );
  });
});
