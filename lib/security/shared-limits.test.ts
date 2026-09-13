// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryRateLimitBackend,
  createRateLimitMiddleware,
  rateLimit,
  setRateLimitBackend,
} from "./rate-limiter";
import {
  CLAIM_TIMEOUT_MS,
  InMemoryWebhookEventBackend,
  createEventGuard,
  setWebhookEventBackend,
} from "./webhook-event-store";

const nowSeconds = () => Math.floor(Date.now() / 1000);

describe("rate limit", () => {
  beforeEach(() => setRateLimitBackend(new InMemoryRateLimitBackend()));

  it("laisse passer exactement la limite, puis refuse", async () => {
    const config = { limit: 2, windowSeconds: 60 };
    expect((await rateLimit("u1", config)).success).toBe(true);
    expect((await rateLimit("u1", config)).success).toBe(true);
    const third = await rateLimit("u1", config);
    expect(third).toMatchObject({ success: false, remaining: 0 });
    expect((await rateLimit("u2", config)).success).toBe(true);
  });

  it("repart a zero apres la fenetre", async () => {
    const backend = new InMemoryRateLimitBackend();
    setRateLimitBackend(backend);
    const config = { limit: 1, windowSeconds: 60 };
    await rateLimit("u1", config);
    backend.buckets.get("rl:u1")!.resetAt = Date.now() - 1;
    expect((await rateLimit("u1", config)).success).toBe(true);
  });

  it("laisse passer si la base est indisponible", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    setRateLimitBackend({ hit: () => Promise.reject(new Error("db down")) });
    expect((await rateLimit("u1", { limit: 1, windowSeconds: 60 })).success).toBe(true);
    error.mockRestore();
  });

  it("le middleware garde son contrat : allowed et delai avant remise a zero", async () => {
    const limiter = createRateLimitMiddleware(1, 60_000);
    expect(await limiter("ip")).toMatchObject({ allowed: true, remaining: 0 });
    const refused = await limiter("ip");
    expect(refused.allowed).toBe(false);
    expect(refused.resetAt).toBeGreaterThan(0);
    expect(refused.resetAt).toBeLessThanOrEqual(60_000);
  });
});

describe("webhook event guard", () => {
  let backend: InMemoryWebhookEventBackend;
  beforeEach(() => {
    backend = new InMemoryWebhookEventBackend();
    setWebhookEventBackend(backend);
  });

  it("une seule instance obtient un evenement", async () => {
    const [a, b] = await Promise.all([
      createEventGuard("evt_1", "invoice.paid", nowSeconds()),
      createEventGuard("evt_1", "invoice.paid", nowSeconds()),
    ]);
    expect([a.shouldProcess, b.shouldProcess].sort()).toEqual([false, true]);
  });

  it("un evenement traite n'est plus repris", async () => {
    const guard = await createEventGuard("evt_1", "invoice.paid", nowSeconds());
    await guard.markProcessed();
    expect((await createEventGuard("evt_1", "invoice.paid", nowSeconds())).shouldProcess).toBe(false);
  });

  it("un echec rend l'evenement au renvoi de Stripe", async () => {
    const guard = await createEventGuard("evt_1", "invoice.paid", nowSeconds());
    await guard.release();
    expect((await createEventGuard("evt_1", "invoice.paid", nowSeconds())).shouldProcess).toBe(true);
  });

  it("reprend l'evenement d'une instance tombee en plein traitement", async () => {
    await createEventGuard("evt_1", "invoice.paid", nowSeconds());
    backend.events.get("evt_1")!.claimedAt = Date.now() - CLAIM_TIMEOUT_MS - 1;
    expect((await createEventGuard("evt_1", "invoice.paid", nowSeconds())).shouldProcess).toBe(true);
  });

  it("ignore un evenement trop vieux", async () => {
    const guard = await createEventGuard("evt_1", "invoice.paid", nowSeconds() - 2 * 24 * 60 * 60);
    expect(guard.shouldProcess).toBe(false);
    expect(backend.events.size).toBe(0);
  });
});
