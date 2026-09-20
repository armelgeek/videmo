import { describe, expect, it, vi } from "vitest";
import { renameWithLock } from "./rename";

describe("renameWithLock", () => {
  it("calls takeLock, patchTitle then releaseLock in that order", async () => {
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

  it("releases the lease and surfaces the error when patchTitle returns ok: false", async () => {
    const deps = {
      takeLock: vi.fn(async () => ({ ok: true })),
      patchTitle: vi.fn(async () => ({ ok: false, error: "Titre invalide" })),
      releaseLock: vi.fn(async () => {}),
    };

    await expect(renameWithLock("p1", "", deps)).rejects.toThrow("Titre invalide");
    expect(deps.releaseLock).toHaveBeenCalledWith("p1");
  });

  it("releases the lease when patchTitle throws", async () => {
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

  it("surfaces the patchTitle error even if releaseLock also rejects", async () => {
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

  it("does not throw when only releaseLock rejects after a successful PATCH", async () => {
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

  it("calls neither patchTitle nor releaseLock when takeLock fails", async () => {
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
