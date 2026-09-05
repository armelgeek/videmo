import { describe, expect, it } from "vitest";
import { LOCK_TTL_MS, acquireLock, lockState, releaseLock } from "./lock";

const NOW = new Date("2026-09-05T10:00:00.000Z");
const inMs = (ms: number) => new Date(NOW.getTime() + ms);

describe("lockState", () => {
  it("is free when nobody holds it", () => {
    expect(lockState({ lockedById: null, lockExpiresAt: null }, "u1", NOW)).toBe(
      "free",
    );
  });

  it("is held-by-me when I hold a valid lease", () => {
    const project = { lockedById: "u1", lockExpiresAt: inMs(60_000) };
    expect(lockState(project, "u1", NOW)).toBe("held-by-me");
  });

  it("is held-by-other when someone else holds a valid lease", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(60_000) };
    expect(lockState(project, "u1", NOW)).toBe("held-by-other");
  });

  it("is free when someone else's lease has expired", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(-1) };
    expect(lockState(project, "u1", NOW)).toBe("free");
  });

  it("is free exactly at the expiry instant", () => {
    const project = { lockedById: "u2", lockExpiresAt: NOW };
    expect(lockState(project, "u1", NOW)).toBe("free");
  });

  it("is free when a holder is recorded without an expiry", () => {
    expect(lockState({ lockedById: "u2", lockExpiresAt: null }, "u1", NOW)).toBe(
      "free",
    );
  });
});

describe("acquireLock", () => {
  it("grants a free lock for the full ttl", () => {
    const granted = acquireLock({ lockedById: null, lockExpiresAt: null }, "u1", NOW);
    expect(granted).toEqual({
      lockedById: "u1",
      lockExpiresAt: inMs(LOCK_TTL_MS),
    });
  });

  it("renews my own lock", () => {
    const project = { lockedById: "u1", lockExpiresAt: inMs(10_000) };
    expect(acquireLock(project, "u1", NOW)?.lockExpiresAt).toEqual(inMs(LOCK_TTL_MS));
  });

  it("takes over an expired lock", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(-1) };
    expect(acquireLock(project, "u1", NOW)?.lockedById).toBe("u1");
  });

  it("refuses a lock held by someone else", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(60_000) };
    expect(acquireLock(project, "u1", NOW)).toBeNull();
  });
});

describe("releaseLock", () => {
  it("clears my own lock", () => {
    const project = { lockedById: "u1", lockExpiresAt: inMs(60_000) };
    expect(releaseLock(project, "u1")).toEqual({
      lockedById: null,
      lockExpiresAt: null,
    });
  });

  it("refuses to clear someone else's lock", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(60_000) };
    expect(releaseLock(project, "u1")).toBeNull();
  });
});
