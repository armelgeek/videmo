import { describe, expect, it, vi } from "vitest";
import { renameWithLock } from "./rename";

describe("renameWithLock", () => {
  it("appelle takeLock, patchTitle puis releaseLock dans cet ordre", async () => {
    const calls: string[] = [];
    const deps = {
      takeLock: vi.fn(async () => {
        calls.push("takeLock");
        return { ok: true };
      }),
      patchTitle: vi.fn(async () => {
        calls.push("patchTitle");
        return { ok: true };
      }),
      releaseLock: vi.fn(async () => {
        calls.push("releaseLock");
      }),
    };

    await renameWithLock("p1", "Nouveau titre", deps);

    expect(calls).toEqual(["takeLock", "patchTitle", "releaseLock"]);
  });

  it("relâche le bail et remonte l'erreur quand patchTitle rend ok: false", async () => {
    const deps = {
      takeLock: vi.fn(async () => ({ ok: true })),
      patchTitle: vi.fn(async () => ({ ok: false, error: "Titre invalide" })),
      releaseLock: vi.fn(async () => {}),
    };

    await expect(renameWithLock("p1", "", deps)).rejects.toThrow("Titre invalide");
    expect(deps.releaseLock).toHaveBeenCalledWith("p1");
  });

  it("relâche le bail quand patchTitle lève une exception", async () => {
    const deps = {
      takeLock: vi.fn(async () => ({ ok: true })),
      patchTitle: vi.fn(async () => {
        throw new Error("Réseau coupé");
      }),
      releaseLock: vi.fn(async () => {}),
    };

    await expect(renameWithLock("p1", "Titre", deps)).rejects.toThrow("Réseau coupé");
    expect(deps.releaseLock).toHaveBeenCalledWith("p1");
  });

  it("remonte l'erreur de patchTitle meme si releaseLock rejette aussi", async () => {
    const deps = {
      takeLock: vi.fn(async () => ({ ok: true })),
      patchTitle: vi.fn(async () => ({ ok: false, error: "Titre invalide" })),
      releaseLock: vi.fn(async () => {
        throw new Error("Réseau coupé sur le relâchement");
      }),
    };

    await expect(renameWithLock("p1", "", deps)).rejects.toThrow("Titre invalide");
    expect(deps.releaseLock).toHaveBeenCalledWith("p1");
  });

  it("ne leve pas quand seul releaseLock rejette apres un PATCH reussi", async () => {
    const deps = {
      takeLock: vi.fn(async () => ({ ok: true })),
      patchTitle: vi.fn(async () => ({ ok: true })),
      releaseLock: vi.fn(async () => {
        throw new Error("Réseau coupé sur le relâchement");
      }),
    };

    await expect(renameWithLock("p1", "Titre", deps)).resolves.toBeUndefined();
    expect(deps.releaseLock).toHaveBeenCalledWith("p1");
  });

  it("n'appelle ni patchTitle ni releaseLock quand takeLock échoue", async () => {
    const deps = {
      takeLock: vi.fn(async () => ({ ok: false })),
      patchTitle: vi.fn(async () => ({ ok: true })),
      releaseLock: vi.fn(async () => {}),
    };

    await expect(renameWithLock("p1", "Titre", deps)).rejects.toThrow(
      "Projet en cours d'édition par un autre membre",
    );
    expect(deps.patchTitle).not.toHaveBeenCalled();
    expect(deps.releaseLock).not.toHaveBeenCalled();
  });
});
