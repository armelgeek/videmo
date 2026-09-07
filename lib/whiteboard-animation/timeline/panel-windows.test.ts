import { describe, expect, it } from "vitest";
import { panelWindows } from "./panel-windows";

describe("panelWindows", () => {
  it("enchaine les images : chacune commence ou la precedente finit", () => {
    const windows = panelWindows(
      [{}, {}],
      [
        { panelIdx: 0, drawStartMs: 0, drawEndMs: 2000 },
        { panelIdx: 1, drawStartMs: 2300, drawEndMs: 5300 },
      ],
    );

    // La fenetre va jusqu'a la FIN du dessin : le blanc de 300 ms qui precede
    // la seconde image lui appartient, comme avant ce changement.
    expect(windows.map((w) => [w.startMs, w.endMs])).toEqual([
      [0, 2000],
      [2000, 5300],
    ]);
  });

  it("donne une fenetre a une image qui ne dessine rien", () => {
    // Le defaut d'origine : sans annotation l'image disparaissait des
    // frontieres, le calage audio retombait sur `?? 0` et la narration
    // repartait du debut en basculant sur elle.
    const windows = panelWindows(
      [{}, { audioDurationMs: 4000 }],
      [{ panelIdx: 0, drawStartMs: 0, drawEndMs: 3000 }],
    );

    expect(windows).toHaveLength(2);
    expect(windows[1].startMs).toBe(3000);
    expect(windows[1].endMs).toBe(7000);
  });

  it("prend la voix mesuree quand le trace ne dit rien", () => {
    const [window] = panelWindows([{ audioDurationMs: 4500, duration: 5 }], []);
    expect(window.endMs).toBe(4500);
  });

  it("retombe sur la duree reglee quand ni trace ni voix", () => {
    const [window] = panelWindows([{ duration: 5 }], []);
    expect(window.endMs).toBe(5000);
  });

  it("garde une fenetre, meme vide, quand rien n'est connu", () => {
    // Une fenetre de duree nulle vaut mieux qu'une image absente : c'est son
    // ABSENCE qui faisait repartir l'audio de zero, pas sa brievete.
    const [window] = panelWindows([{}], []);
    expect(window).toMatchObject({ panelIdx: 0, startMs: 0, endMs: 0 });
  });

  it("laisse le trace primer sur la voix la ou il existe", () => {
    // Les temps de revelation que le moteur anime viennent du trace : poser la
    // fenetre ailleurs desynchroniserait le dessin de sa propre fenetre.
    const [window] = panelWindows(
      [{ audioDurationMs: 9000 }],
      [{ panelIdx: 0, drawStartMs: 0, drawEndMs: 2000 }],
    );
    expect(window.endMs).toBe(2000);
  });

  it("conserve les bornes du trace pour le calcul des transitions", () => {
    const windows = panelWindows(
      [{}, {}],
      [
        { panelIdx: 0, drawStartMs: 0, drawEndMs: 2000 },
        { panelIdx: 1, drawStartMs: 2300, drawEndMs: 5300 },
      ],
    );

    // Le blanc entre deux images se mesure sur le dessin, pas sur la fenetre.
    expect(windows[1].drawStartMs - windows[0].drawEndMs).toBe(300);
  });
});
