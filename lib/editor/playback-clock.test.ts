import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  abonnerPositionLecture,
  lirePositionLecture,
  poserPositionLecture,
} from "./playback-clock";

describe("horloge de lecture", () => {
  beforeEach(() => {
    poserPositionLecture(0);
  });

  it("rend la derniere position posee", () => {
    poserPositionLecture(12.5);
    expect(lirePositionLecture()).toBe(12.5);
  });

  it("ne reveille personne quand la valeur ne change pas", () => {
    // La boucle appelle a chaque frame, y compris quand rien n'avance : une
    // position inchangee ne doit declencher aucun rendu.
    const vu: number[] = [];
    const desabonner = abonnerPositionLecture(() => vu.push(lirePositionLecture()));

    poserPositionLecture(1);
    poserPositionLecture(1);
    poserPositionLecture(2);

    desabonner();
    expect(vu).toEqual([1, 2]);
  });

  it("cesse de reveiller apres desabonnement, mais garde la valeur", () => {
    const abonne = vi.fn();
    const desabonner = abonnerPositionLecture(abonne);

    poserPositionLecture(3);
    desabonner();
    poserPositionLecture(4);

    expect(abonne).toHaveBeenCalledTimes(1);
    expect(lirePositionLecture()).toBe(4);
  });

  it("sert plusieurs abonnes", () => {
    const a = vi.fn();
    const b = vi.fn();
    const da = abonnerPositionLecture(a);
    const db = abonnerPositionLecture(b);

    poserPositionLecture(7);

    da();
    db();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
