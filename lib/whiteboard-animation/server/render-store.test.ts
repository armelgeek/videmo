import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  attachChild, cancelRenderJob, createRenderJob, finalizeRenderJob,
  getRenderJob, oublierJobsEnMemoire, updateRenderJob,
} from "./render-store";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "wb-store-"));
  process.env.RENDER_OUTPUT_DIR = dir;
  oublierJobsEnMemoire();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  delete process.env.RENDER_OUTPUT_DIR;
});

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

  it("survit a la perte de la memoire", () => {
    // Next recompile ses routes a chaud : l'etat du module est remis a zero, et
    // le job disparaissait alors que sa video etait sur le disque. Observe deux
    // fois en conditions reelles, avec un 404 en pleine progression.
    const job = createRenderJob("u1");
    updateRenderJob(job.id, { status: "rendering", progress: 60 });

    oublierJobsEnMemoire();

    expect(getRenderJob(job.id, "u1")).toMatchObject({
      id: job.id, userId: "u1", status: "rendering", progress: 60,
    });
  });

  it("garde le cloisonnement apres rechargement", () => {
    const job = createRenderJob("u1");
    oublierJobsEnMemoire();
    expect(getRenderJob(job.id, "u2")).toBeUndefined();
  });

  it("ignore un fichier d'etat illisible", () => {
    writeFileSync(join(dir, "casse.json"), "{ pas du json");
    expect(getRenderJob("casse", "u1")).toBeUndefined();
  });

  it("annuler tue l'enfant et marque le job", () => {
    const job = createRenderJob("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(cancelRenderJob(job.id, "u1")).toBe(true);
    expect(kill).toHaveBeenCalledOnce();
    expect(getRenderJob(job.id, "u1")?.status).toBe("cancelled");
  });

  it("un autre utilisateur ne peut pas annuler", () => {
    const job = createRenderJob("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    expect(cancelRenderJob(job.id, "u2")).toBe(false);
    expect(kill).not.toHaveBeenCalled();
  });

  it("conclut un job encore en cours", () => {
    const job = createRenderJob("u1");
    updateRenderJob(job.id, { status: "rendering", progress: 88 });
    finalizeRenderJob(job.id, { status: "done", progress: 100 });
    expect(getRenderJob(job.id, "u1")).toMatchObject({ status: "done", progress: 100 });
  });

  it("n'ecrase pas une annulation deliberee", () => {
    const job = createRenderJob("u1");
    attachChild(job.id, { kill: () => {} });
    cancelRenderJob(job.id, "u1");
    finalizeRenderJob(job.id, { status: "error", error: "Rendu interrompu (SIGTERM)" });
    expect(getRenderJob(job.id, "u1")?.status).toBe("cancelled");
  });

  it("n'annule pas un rendu deja abouti", () => {
    // Un clic sur « Annuler » dans la derniere seconde faisait passer le job a
    // 'cancelled' alors que la video etait ecrite : la route de telechargement
    // exige 'done' et repondait 404. Rendu abouti, perdu.
    const job = createRenderJob("u1");
    const kill = vi.fn();
    attachChild(job.id, { kill });
    finalizeRenderJob(job.id, { status: "done", progress: 100, outputPath: "/x.mp4" });

    expect(cancelRenderJob(job.id, "u1")).toBe(false);
    expect(kill).not.toHaveBeenCalled();
    expect(getRenderJob(job.id, "u1")).toMatchObject({ status: "done", outputPath: "/x.mp4" });
  });

  it("refuse un id qui n'est pas un UUID, donc tout echappement de dossier", () => {
    // L'id vient d'un segment d'URL et devient un chemin de fichier.
    writeFileSync(join(dir, "..", "vole.json"), JSON.stringify({ id: "x", userId: "u1" }));
    expect(getRenderJob("../vole", "u1")).toBeUndefined();
    expect(getRenderJob("..%2Fvole", "u1")).toBeUndefined();
    rmSync(join(dir, "..", "vole.json"), { force: true });
  });

  it("n'ecrase pas un job deja conclu, meme apres rechargement", () => {
    const job = createRenderJob("u1");
    finalizeRenderJob(job.id, { status: "done", progress: 100 });
    oublierJobsEnMemoire();
    finalizeRenderJob(job.id, { status: "error", error: "trop tard" });
    expect(getRenderJob(job.id, "u1")).toMatchObject({ status: "done", error: null });
  });
});
