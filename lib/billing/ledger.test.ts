import { describe, expect, it } from "vitest";
import { InsufficientCreditsError } from "./errors";
import { isWithinLimit, planDebit, purchasedBalance, remainingUnderLimit } from "./ledger";

const now = new Date("2026-09-15T00:00:00.000Z");
const inDays = (days: number) => new Date(now.getTime() + days * 86_400_000);

describe("planDebit", () => {
  it("takes from plan credits first", () => {
    const purchases = [{ id: "a", remainingCredits: 100, expiresAt: inDays(30) }];
    expect(planDebit(20, purchases, 5, now)).toEqual({
      fromPlan: 5,
      fromPurchases: [],
      source: "plan",
    });
  });

  it("spills into purchases closest to expiry", () => {
    const purchases = [
      { id: "late", remainingCredits: 50, expiresAt: inDays(300) },
      { id: "soon", remainingCredits: 4, expiresAt: inDays(10) },
    ];
    expect(planDebit(3, purchases, 10, now)).toEqual({
      fromPlan: 3,
      fromPurchases: [
        { id: "soon", amount: 4 },
        { id: "late", amount: 3 },
      ],
      source: "mixed",
    });
  });

  it("uses purchases only when plan credits are gone", () => {
    const purchases = [{ id: "a", remainingCredits: 10, expiresAt: inDays(5) }];
    expect(planDebit(0, purchases, 8, now).source).toBe("purchased");
  });

  it("ignores expired purchases", () => {
    const purchases = [{ id: "old", remainingCredits: 100, expiresAt: inDays(-1) }];
    expect(() => planDebit(0, purchases, 1, now)).toThrow(InsufficientCreditsError);
  });

  it("reports the real balance when refusing", () => {
    const purchases = [{ id: "a", remainingCredits: 2, expiresAt: inDays(5) }];
    try {
      planDebit(3, purchases, 10, now);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ balance: 5, required: 10 });
    }
  });

  it("treats a negative plan balance as empty", () => {
    expect(() => planDebit(-5, [], 1, now)).toThrow(InsufficientCreditsError);
  });

  it("allows spending the exact balance", () => {
    expect(planDebit(8, [], 8, now).fromPlan).toBe(8);
  });
});

describe("purchasedBalance", () => {
  it("sums only unexpired purchases", () => {
    const purchases = [
      { id: "a", remainingCredits: 10, expiresAt: inDays(5) },
      { id: "b", remainingCredits: 99, expiresAt: inDays(-5) },
    ];
    expect(purchasedBalance(purchases, now)).toBe(10);
  });
});

describe("limits", () => {
  it("never blocks an unlimited quota", () => {
    expect(isWithinLimit(-1, 1_000_000)).toBe(true);
    expect(remainingUnderLimit(-1, 5)).toBeNull();
  });

  it("blocks once usage reaches the limit", () => {
    expect(isWithinLimit(3, 2)).toBe(true);
    expect(isWithinLimit(3, 3)).toBe(false);
    expect(remainingUnderLimit(3, 5)).toBe(0);
  });
});
