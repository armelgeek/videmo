import { describe, expect, it } from "vitest";
import { isValidUnsubscribeSignature, unsubscribeSignature, unsubscribeUrl } from "./unsubscribe";

const SECRET = "test-secret-that-is-long-enough-000";

describe("unsubscribe links", () => {
  it("accepts the signature it produced", () => {
    const sig = unsubscribeSignature("user_1", SECRET);
    expect(isValidUnsubscribeSignature("user_1", sig, SECRET)).toBe(true);
  });

  it("rejects a signature for another user or a tampered one", () => {
    const sig = unsubscribeSignature("user_1", SECRET);
    expect(isValidUnsubscribeSignature("user_2", sig, SECRET)).toBe(false);
    expect(isValidUnsubscribeSignature("user_1", `${sig}x`, SECRET)).toBe(false);
  });

  it("fails closed without a secret or parameters", () => {
    expect(isValidUnsubscribeSignature("user_1", "abc", undefined)).toBe(false);
    expect(isValidUnsubscribeSignature(null, "abc", SECRET)).toBe(false);
    expect(() => unsubscribeSignature("user_1", undefined)).toThrow();
  });

  it("builds a link carrying the user and signature", () => {
    const url = new URL(unsubscribeUrl("https://app.test", "user_1", SECRET));
    expect(url.pathname).toBe("/api/emails/unsubscribe");
    expect(isValidUnsubscribeSignature(url.searchParams.get("u"), url.searchParams.get("s"), SECRET)).toBe(true);
  });
});
