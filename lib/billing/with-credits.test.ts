import { describe, expect, it, vi } from "vitest";
import { InsufficientCreditsError, QuotaExceededError } from "./errors";
import { type ChargeDeps, billingErrorResponse, chargeFor } from "./with-credits";

const VIEWER = { userId: "u1", organizationId: "org-1" };

function deps(overrides: Partial<ChargeDeps> = {}) {
  return {
    consume: vi.fn(async () => ({ id: "txn-1" })),
    refund: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("chargeFor", () => {
  it("debits and keeps the charge on success", async () => {
    const d = deps();
    const response = await chargeFor(VIEWER, "generate_image", async () => Response.json({ ok: 1 }), {
      deps: d,
    });

    expect(response.status).toBe(200);
    expect(d.consume).toHaveBeenCalledWith({
      organizationId: "org-1",
      userId: "u1",
      action: "generate_image",
      referenceId: undefined,
    });
    expect(d.refund).not.toHaveBeenCalled();
  });

  it("answers 402 without running the work when credits are short", async () => {
    const run = vi.fn(async () => Response.json({}));
    const d = deps({
      consume: vi.fn(async () => {
        throw new InsufficientCreditsError(3, 8);
      }),
    });

    const response = await chargeFor(VIEWER, "generate_image", run, { deps: d });

    expect(response.status).toBe(402);
    expect(await response.json()).toMatchObject({ code: "insufficient_credits", balance: 3, required: 8 });
    expect(run).not.toHaveBeenCalled();
  });

  it("refunds when the work answers an error status", async () => {
    const d = deps();
    const response = await chargeFor(
      VIEWER,
      "generate_image",
      async () => Response.json({ error: "provider down" }, { status: 502 }),
      { deps: d },
    );

    expect(response.status).toBe(502);
    expect(d.refund).toHaveBeenCalledWith("txn-1", "Generation failed (502)");
  });

  it("refunds and rethrows when the work throws", async () => {
    const d = deps();
    const boom = new Error("boom");

    await expect(
      chargeFor(VIEWER, "generate_image", async () => {
        throw boom;
      }, { deps: d }),
    ).rejects.toBe(boom);
    expect(d.refund).toHaveBeenCalledWith("txn-1", "Generation failed");
  });

  it("keeps the original error when the refund itself fails", async () => {
    const d = deps({
      refund: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await chargeFor(
      VIEWER,
      "generate_image",
      async () => Response.json({}, { status: 500 }),
      { deps: d },
    );
    expect(response.status).toBe(500);
  });

  it("refuses without an active organization", async () => {
    const d = deps();
    const response = await chargeFor({ userId: "u1", organizationId: null }, "generate_image", async () =>
      Response.json({}), { deps: d });

    expect(response.status).toBe(403);
    expect(d.consume).not.toHaveBeenCalled();
  });

  it("lets unexpected consume errors propagate", async () => {
    const d = deps({
      consume: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    await expect(
      chargeFor(VIEWER, "generate_image", async () => Response.json({}), { deps: d }),
    ).rejects.toThrow("db down");
  });
});

describe("billingErrorResponse", () => {
  it("maps a quota refusal to 403", () => {
    expect(billingErrorResponse(new QuotaExceededError("max_projects", 3, 3))?.status).toBe(403);
  });

  it("ignores unrelated errors", () => {
    expect(billingErrorResponse(new Error("x"))).toBeNull();
  });
});
