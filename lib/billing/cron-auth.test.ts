import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

const SECRET = "s".repeat(40);

describe("isAuthorizedCronRequest", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("refuses when no secret is configured", () => {
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
  });

  it("refuses a secret too short to be safe, even when it matches", () => {
    expect(isAuthorizedCronRequest("Bearer short", "short")).toBe(false);
  });

  it("refuses a missing or non-bearer header", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Basic ${SECRET}`, SECRET)).toBe(false);
  });

  it("refuses a wrong token of the same length", () => {
    expect(isAuthorizedCronRequest(`Bearer ${"x".repeat(40)}`, SECRET)).toBe(false);
  });

  it("refuses a token of another length", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
  });
});
