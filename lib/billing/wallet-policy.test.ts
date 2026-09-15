import { describe, expect, it } from "vitest";
import { addMonths, initialResetAt, isPaidStatus } from "./wallet-policy";

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("addMonths", () => {
  it("adds a month on an ordinary day", () => {
    expect(addMonths(utc("2026-09-15"), 1)).toEqual(utc("2026-10-15"));
  });

  it("clamps to the end of a shorter month", () => {
    expect(addMonths(utc("2026-01-31"), 1)).toEqual(utc("2026-02-28"));
  });

  it("crosses the year", () => {
    expect(addMonths(utc("2026-12-15"), 1)).toEqual(utc("2027-01-15"));
  });
});

describe("initialResetAt", () => {
  const now = utc("2026-09-15");

  it("defaults to one month ahead", () => {
    expect(initialResetAt(now)).toEqual(utc("2026-10-15"));
  });

  it("uses a monthly period end that is still ahead", () => {
    expect(initialResetAt(now, utc("2026-09-30"))).toEqual(utc("2026-09-30"));
  });

  it("ignores a yearly period end", () => {
    expect(initialResetAt(now, utc("2027-03-01"))).toEqual(utc("2026-10-15"));
  });

  it("ignores a period end already passed", () => {
    expect(initialResetAt(now, utc("2026-09-01"))).toEqual(utc("2026-10-15"));
  });
});

describe("isPaidStatus", () => {
  it("counts active and trialing as paid", () => {
    expect(isPaidStatus("active")).toBe(true);
    expect(isPaidStatus("trialing")).toBe(true);
  });

  it("does not count past_due or canceled", () => {
    expect(isPaidStatus("past_due")).toBe(false);
    expect(isPaidStatus("canceled")).toBe(false);
  });
});
