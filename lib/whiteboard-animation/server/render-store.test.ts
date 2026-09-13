// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  InMemoryRenderJobBackend,
  STALE_AFTER_MS,
  STALE_ERROR,
  attachChild,
  cancelRenderJob,
  finalizeRenderJob,
  forgetLocalChildren,
  getRenderJob,
  reportRenderProgress,
  reserveRenderJob,
  setRenderJobBackend,
  takeExpiredRenders,
  type RenderJob,
} from "./render-store";

const LIMITS = { perUser: 1, global: 2, perInstance: 5 };
let backend: InMemoryRenderJobBackend;

async function reserve(userId: string, limits = LIMITS): Promise<RenderJob> {
  const job = await reserveRenderJob(userId, limits);
  if (typeof job === "string") throw new Error(`refused: ${job}`);
  return job;
}

beforeEach(() => {
  backend = new InMemoryRenderJobBackend();
  setRenderJobBackend(backend);
  forgetLocalChildren();
});

describe("render-store", () => {
  it("reserve un job en cours, a zero", async () => {
    const job = await reserve("u1");
    expect(job).toMatchObject({ userId: "u1", status: "rendering", progress: 0 });
    expect(job.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("ne rend pas le job d'un autre utilisateur", async () => {
    const job = await reserve("u1");
    expect(await getRenderJob(job.id, "u1")).toBeDefined();
    expect(await getRenderJob(job.id, "u2")).toBeUndefined();
  });

  it("refuse un id qui n'est pas un UUID", async () => {
    expect(await getRenderJob("../vole", "u1")).toBeUndefined();
    expect(await cancelRenderJob("../vole", "u1")).toBe(false);
  });

  it("met a jour la progression", async () => {
    const job = await reserve("u1");
    expect(await reportRenderProgress(job.id, 42)).toBe(true);
    expect(await getRenderJob(job.id, "u1")).toMatchObject({ progress: 42 });
  });

  it("annuler tue l'enfant et marque le job", async () => {
    const job = await reserve("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(await cancelRenderJob(job.id, "u1")).toBe(true);
    expect(kill).toHaveBeenCalledOnce();
    expect((await getRenderJob(job.id, "u1"))?.status).toBe("cancelled");
  });

  it("un autre utilisateur ne peut pas annuler", async () => {
    const job = await reserve("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(await cancelRenderJob(job.id, "u2")).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });

  it("une annulation recue par une autre instance atteint le process au signal suivant", async () => {
    const job = await reserve("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });

    // L'annulation arrive sur une instance qui ne tient pas le process.
    expect(await backend.cancel(job.id, "u1")).toBe(true);
    expect(kill).not.toHaveBeenCalled();

    expect(await reportRenderProgress(job.id, 50)).toBe(false);
    expect(kill).toHaveBeenCalledOnce();
  });

  it("n'ecrase pas une annulation deliberee", async () => {
    const job = await reserve("u1");
    await cancelRenderJob(job.id, "u1");
    expect(await finalizeRenderJob(job.id, { status: "error", error: "SIGTERM" })).toBe(false);
    expect((await getRenderJob(job.id, "u1"))?.status).toBe("cancelled");
  });

  it("n'annule pas un rendu deja abouti", async () => {
    const job = await reserve("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    await finalizeRenderJob(job.id, { status: "done", progress: 100, outputKey: "renders/u1/x.mp4" });

    expect(await cancelRenderJob(job.id, "u1")).toBe(false);
    expect(kill).not.toHaveBeenCalled();
    expect(await getRenderJob(job.id, "u1")).toMatchObject({ status: "done", outputKey: "renders/u1/x.mp4" });
  });
});

describe("render limits", () => {
  it("un seul rendu a la fois par utilisateur", async () => {
    await reserve("u1");
    expect(await reserveRenderJob("u1", LIMITS)).toBe("user");
    expect(typeof (await reserveRenderJob("u2", LIMITS))).toBe("object");
  });

  it("plafonne le parc entier, pas seulement l'instance", async () => {
    await reserve("u1");
    // Une autre instance a reserve la deuxieme place : elle ne tient aucun
    // process ici, mais la place est prise.
    forgetLocalChildren();
    await reserve("u2");
    expect(await reserveRenderJob("u3", LIMITS)).toBe("global");
  });

  it("plafonne les process de cette instance", async () => {
    const job = await reserve("u1", { perUser: 5, global: 5, perInstance: 1 });
    attachChild(job.id, { kill: () => {} });
    expect(await reserveRenderJob("u2", { perUser: 5, global: 5, perInstance: 1 })).toBe("global");
  });

  it("libere la place d'une instance morte", async () => {
    const job = await reserve("u1");
    backend.rows.get(job.id)!.heartbeatAt = new Date(Date.now() - STALE_AFTER_MS - 1000);

    expect(typeof (await reserveRenderJob("u1", LIMITS))).toBe("object");
    expect(await getRenderJob(job.id, "u1")).toMatchObject({ status: "error", error: STALE_ERROR });
  });

  it("retire les rendus conclus expires, jamais un rendu actif", async () => {
    const done = await reserve("u1");
    await finalizeRenderJob(done.id, { status: "done", outputKey: "renders/u1/old.mp4" });
    const running = await reserve("u2");
    const recent = await reserve("u3", { ...LIMITS, global: 5 });
    await finalizeRenderJob(recent.id, { status: "done" });

    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    backend.rows.get(done.id)!.createdAt = old;
    backend.rows.get(running.id)!.createdAt = old;

    const expired = await takeExpiredRenders(24 * 60 * 60 * 1000);
    expect(expired.map((j) => j.outputKey)).toEqual(["renders/u1/old.mp4"]);
    expect(await getRenderJob(done.id, "u1")).toBeUndefined();
    expect(await getRenderJob(running.id, "u2")).toBeDefined();
    expect(await getRenderJob(recent.id, "u3")).toBeDefined();
  });
});
