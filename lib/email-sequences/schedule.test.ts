import { describe, expect, it } from "vitest";
import { monthRange, onboardingSchedule, parseKind, previousMonthKey } from "./schedule";

describe("onboardingSchedule", () => {
  it("spaces the steps from the verification date", () => {
    const verifiedAt = new Date("2026-09-10T08:00:00Z");
    expect(onboardingSchedule(verifiedAt)).toEqual([
      { kind: "onboarding:1", sendAt: new Date("2026-09-11T08:00:00Z") },
      { kind: "onboarding:2", sendAt: new Date("2026-09-13T08:00:00Z") },
      { kind: "onboarding:3", sendAt: new Date("2026-09-16T08:00:00Z") },
    ]);
  });
});

describe("previousMonthKey", () => {
  it("returns the month before", () => {
    expect(previousMonthKey(new Date("2026-09-01T02:00:00Z"))).toBe("2026-08");
  });

  it("wraps to the previous year in January", () => {
    expect(previousMonthKey(new Date("2027-01-15T00:00:00Z"))).toBe("2026-12");
  });
});

describe("monthRange", () => {
  it("covers the whole month, end exclusive", () => {
    expect(monthRange("2026-12")).toEqual({
      start: new Date("2026-12-01T00:00:00Z"),
      end: new Date("2027-01-01T00:00:00Z"),
    });
  });
});

describe("parseKind", () => {
  it("reads onboarding and digest kinds", () => {
    expect(parseKind("onboarding:2")).toEqual({ type: "onboarding", step: 2 });
    expect(parseKind("digest:2026-08")).toEqual({ type: "digest", month: "2026-08" });
  });

  it("rejects unknown steps and malformed kinds", () => {
    expect(parseKind("onboarding:9")).toBeNull();
    expect(parseKind("digest:august")).toBeNull();
    expect(parseKind("promo:1")).toBeNull();
  });
});
