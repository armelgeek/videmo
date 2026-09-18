import { describe, expect, it } from "vitest";
import { hashApiKey, readBearerApiKey } from "./authenticate";

describe("readBearerApiKey", () => {
  it("lit une cle sk_live_ dans l'en-tete Authorization", () => {
    expect(readBearerApiKey("Bearer sk_live_abc123")).toBe("sk_live_abc123");
    expect(readBearerApiKey("bearer   sk_live_abc123")).toBe("sk_live_abc123");
  });

  it("ignore tout autre jeton, pour laisser la session du navigateur decider", () => {
    expect(readBearerApiKey(null)).toBeNull();
    expect(readBearerApiKey("Bearer eyJhbGciOi")).toBeNull();
    expect(readBearerApiKey("sk_live_abc123")).toBeNull();
  });
});

describe("hashApiKey", () => {
  it("ne stocke jamais la cle en clair et reste stable", () => {
    const hash = hashApiKey("sk_live_abc123");
    expect(hash).not.toContain("abc123");
    expect(hash).toBe(hashApiKey("sk_live_abc123"));
  });
});
