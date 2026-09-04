import { describe, expect, it, vi } from "vitest";
import {
  attachChild, cancelRenderJob, createRenderJob, finalizeRenderJob,
  getRenderJob, updateRenderJob,
} from "./render-store";

describe("render-store", () => {
  it("cree un job en attente, a zero", () => {
    const job = createRenderJob("u1");
    expect(job).toMatchObject({ userId: "u1", status: "pending", progress: 0 });
    expect(job.id).toBeTruthy();
  });

  it("ne rend pas le job d'un autre utilisateur", () => {
    const job = createRenderJob("u1");
    expect(getRenderJob(job.id, "u1")).toBeDefined();
    expect(getRenderJob(job.id, "u2")).toBeUndefined();
  });

  it("rend undefined sur un job inconnu", () => {
    expect(getRenderJob("inexistant", "u1")).toBeUndefined();
  });

  it("met a jour la progression", () => {
    const job = createRenderJob("u1");
    updateRenderJob(job.id, { status: "rendering", progress: 42 });
    expect(getRenderJob(job.id, "u1")).toMatchObject({ status: "rendering", progress: 42 });
  });

  it("annuler tue l'enfant et marque le job", () => {
    const job = createRenderJob("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(cancelRenderJob(job.id, "u1")).toBe(true);
    expect(kill).toHaveBeenCalledOnce();
    expect(getRenderJob(job.id, "u1")?.status).toBe("cancelled");
  });

  it("conclut un job encore en cours", () => {
    const job = createRenderJob("u1");
    updateRenderJob(job.id, { status: "rendering", progress: 88 });
    finalizeRenderJob(job.id, { status: "done", progress: 100 });
    expect(getRenderJob(job.id, "u1")).toMatchObject({ status: "done", progress: 100 });
  });

  it("n'ecrase pas une annulation deliberee", () => {
    // La sortie du process suit l'annulation : sans cette garde, un arret
    // volontaire s'afficherait comme une erreur.
    const job = createRenderJob("u1");
    attachChild(job.id, { kill: () => {} });
    cancelRenderJob(job.id, "u1");
    finalizeRenderJob(job.id, { status: "error", error: "Rendu interrompu (SIGTERM)" });
    expect(getRenderJob(job.id, "u1")?.status).toBe("cancelled");
  });

  it("n'ecrase pas un job deja conclu", () => {
    const job = createRenderJob("u1");
    finalizeRenderJob(job.id, { status: "done", progress: 100 });
    finalizeRenderJob(job.id, { status: "error", error: "trop tard" });
    expect(getRenderJob(job.id, "u1")).toMatchObject({ status: "done", error: null });
  });

  it("un autre utilisateur ne peut pas annuler", () => {
    const job = createRenderJob("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(cancelRenderJob(job.id, "u2")).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });
});
