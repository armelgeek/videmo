import { describe, expect, it } from "vitest";
import {
  annotationPlanSchema,
  buildVisionPrompt,
  clampRegion,
  planAnnotations,
  snapRegionsToSubjects,
  snapToSubject,
  wholeImageRegion,
} from "./annotation-planning";
import type { ScriptScene } from "./script-generation";

const SIZE = { width: 1536, height: 1024 };

const scene: ScriptScene = {
  index: 0,
  clipType: "intro",
  title: "Le levain",
  imagePrompt: "a starter jar and a loaf",
  beats: [
    { narration: "Le levain est une culture vivante.", durationSec: 6 },
    { narration: "Il donne au pain son gout acidule.", durationSec: 4 },
  ],
  visualDescription: "",
  keyElements: [],
};

describe("clampRegion", () => {
  it("laisse intact un rectangle deja dans l'image", () => {
    const r = clampRegion({ beatIndex: 0, x: 100, y: 200, width: 300, height: 400 }, SIZE);

    expect(r).toEqual({ beatIndex: 0, x: 100, y: 200, width: 300, height: 400 });
  });

  it("rabote un rectangle qui deborde", () => {
    // Une region hors cadre ferait dessiner le stylo dans le vide.
    const r = clampRegion({ beatIndex: 0, x: 1400, y: 900, width: 800, height: 800 }, SIZE);

    expect(r.x + r.width).toBeLessThanOrEqual(SIZE.width);
    expect(r.y + r.height).toBeLessThanOrEqual(SIZE.height);
  });

  it("ramene des coordonnees negatives dans l'image", () => {
    const r = clampRegion({ beatIndex: 0, x: -50, y: -20, width: 200, height: 100 }, SIZE);

    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it("interprete une reponse en fractions comme des pixels", () => {
    // Les modeles de vision repondent parfois en proportions de l'image.
    const r = clampRegion({ beatIndex: 1, x: 0.5, y: 0.25, width: 0.25, height: 0.5 }, SIZE);

    expect(r.x).toBe(768);
    expect(r.y).toBe(256);
    expect(r.width).toBe(384);
    expect(r.height).toBe(512);
  });

  it("ne rend jamais une largeur nulle", () => {
    const r = clampRegion({ beatIndex: 0, x: 10, y: 10, width: -5, height: -5 }, SIZE);

    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });
});

describe("planAnnotations", () => {
  const regions = [
    { beatIndex: 0, x: 0, y: 0, width: 700, height: 1024 },
    { beatIndex: 1, x: 800, y: 0, width: 700, height: 1024 },
  ];

  it("fait entrer chaque annotation apres les precedentes", () => {
    // Le moment d'entree ne demande aucun modele : il se deduit des temps.
    const plan = planAnnotations({ scene, regions, size: SIZE });

    expect(plan[0].reveal).toEqual({ startMs: 0, durationMs: 6000 });
    expect(plan[1].reveal).toEqual({ startMs: 6000, durationMs: 4000 });
  });

  it("porte le texte dit pendant le trace", () => {
    const plan = planAnnotations({ scene, regions, size: SIZE });

    expect(plan[0].text).toBe("Le levain est une culture vivante.");
    expect(plan[1].text).toBe("Il donne au pain son gout acidule.");
  });

  it("couvre toute l'image quand la scene n'a aucun temps", () => {
    const plan = planAnnotations({
      scene: { ...scene, beats: [] },
      regions: [],
      size: SIZE,
    });

    expect(plan).toHaveLength(1);
    expect(plan[0].region).toEqual({
      x: 0,
      y: 0,
      width: SIZE.width,
      height: SIZE.height,
    });
    expect(plan[0].reveal.startMs).toBe(0);
    expect(plan[0].reveal.durationMs).toBeGreaterThan(0);
  });

  it("cale l'image sans temps sur la voix mesuree", () => {
    const plan = planAnnotations({
      scene: { ...scene, beats: [] },
      regions: [],
      size: SIZE,
      beatDurationsMs: [3000, 2500],
    });

    expect(plan[0].reveal.durationMs).toBe(5500);
  });

  it("place chaque annotation sur sa zone", () => {
    const plan = planAnnotations({ scene, regions, size: SIZE });

    expect(plan[0].region.x).toBe(0);
    expect(plan[1].region.x).toBe(800);
  });

  it("garde l'image entiere pour un temps sans region lue", () => {
    // Mieux vaut une zone trop large qu'une scene ou rien ne se dessine.
    const plan = planAnnotations({ scene, regions: [regions[0]], size: SIZE });

    expect(plan[1].region).toEqual({ x: 0, y: 0, width: 1536, height: 1024 });
    expect(plan[1].reveal.startMs).toBe(6000);
  });

  it("rabote une region debordante venue de la vision", () => {
    const plan = planAnnotations({
      scene,
      regions: [{ beatIndex: 0, x: 1500, y: 1000, width: 900, height: 900 }],
      size: SIZE,
    });

    expect(plan[0].region.x + plan[0].region.width).toBeLessThanOrEqual(1536);
  });

  it("cale le trace sur la duree reellement mesuree", () => {
    // Le decoupage estimait 6s puis 5s ; l'audio produit dure autrement, et
    // c'est lui qui commande.
    const plan = planAnnotations({
      scene,
      regions,
      size: SIZE,
      beatDurationsMs: [5200, 3800],
    });

    expect(plan[0].reveal).toEqual({ startMs: 0, durationMs: 5200 });
    expect(plan[1].reveal).toEqual({ startMs: 5200, durationMs: 3800 });
  });

  it("retombe sur l'estimation quand la mesure manque", () => {
    const plan = planAnnotations({
      scene,
      regions,
      size: SIZE,
      beatDurationsMs: [5200],
    });

    expect(plan[0].reveal.durationMs).toBe(5200);
    expect(plan[1].reveal.durationMs).toBe(4000);
    expect(plan[1].reveal.startMs).toBe(5200);
  });

  it("ignore une mesure aberrante", () => {
    const plan = planAnnotations({
      scene,
      regions,
      size: SIZE,
      beatDurationsMs: [0, -1],
    });

    expect(plan[0].reveal.durationMs).toBe(6000);
    expect(plan[1].reveal.durationMs).toBe(4000);
  });

  it("rend une annotation par temps quand chacun n'a qu'une zone", () => {
    expect(planAnnotations({ scene, regions: [], size: SIZE })).toHaveLength(2);
  });

  it("rend PLUSIEURS annotations pour un temps qui nomme plusieurs sujets", () => {
    // Une narration decrit souvent plusieurs choses dessinees. L'ancienne Map
    // indexee par beatIndex n'en gardait qu'une : la scene n'obtenait jamais
    // qu'un rectangle par phrase, cadre si large qu'il couvrait le reste.
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, label: "Grain", x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, label: "Table", x: 400, y: 0, width: 300, height: 300 },
        { beatIndex: 1, label: "Tasse", x: 800, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
    });

    expect(plan).toHaveLength(3);
    expect(plan.map((a) => a.beatIndex)).toEqual([0, 0, 1]);
    expect(plan.map((a) => a.text)).toEqual(["Grain", "Table", "Tasse"]);
  });

  it("partage le temps du beat entre ses zones, sans en perdre une milliseconde", () => {
    // La somme doit valoir EXACTEMENT la duree mesuree : un arrondi perdu se
    // repercuterait sur tous les temps suivants.
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 300, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 600, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
      beatDurationsMs: [5000, 4000],
    });

    const duTemps0 = plan.filter((a) => a.beatIndex === 0);
    expect(duTemps0.map((a) => a.reveal.durationMs)).toEqual([1666, 1666, 1668]);
    expect(
      duTemps0.reduce((total, a) => total + a.reveal.durationMs, 0),
    ).toBe(5000);
  });

  it("enchaine les zones d'un meme temps sans trou", () => {
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 300, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
      beatDurationsMs: [5000, 4000],
    });

    expect(plan.map((a) => a.reveal.startMs)).toEqual([0, 2500, 5000]);
  });

  it("ne repete pas la phrase sur chaque sujet d'un meme temps", () => {
    // Sans etiquette, seule la premiere zone la porte : la repeter remplirait
    // la liste et le transcript de la meme ligne.
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 0, x: 300, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
    });

    expect(plan[0].text).toBe(scene.beats[0].narration);
    expect(plan[1].text).toBe("");
  });

  it("rattache une zone au dernier beat si son index depasse, pour ne rien perdre", () => {
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, label: "Un", x: 0, y: 0, width: 300, height: 300 },
        { beatIndex: 99, label: "Hors borne", x: 300, y: 0, width: 300, height: 300 },
      ],
      size: SIZE,
    });

    expect(plan).toHaveLength(2);
    expect(plan[1].beatIndex).toBe(1);
    expect(plan[1].text).toBe("Hors borne");
  });

  it("regroupe les zones en une seule englobante quand la duree totale est trop courte (< 800ms)", () => {
    // Un beat court de 600ms avec deux zones de 300ms chacune (< 400ms)
    // est fusionné en une zone englobante unique de 600ms
    const plan = planAnnotations({
      scene,
      regions: [
        { beatIndex: 0, label: "A", x: 100, y: 100, width: 100, height: 100 },
        { beatIndex: 0, label: "B", x: 300, y: 100, width: 100, height: 100 },
      ],
      size: SIZE,
      beatDurationsMs: [600, 4000],
    });

    const beat0 = plan.filter((a) => a.beatIndex === 0);
    expect(beat0).toHaveLength(1);
    expect(beat0[0].reveal.durationMs).toBe(600);
    // Zone englobante couvrant de x=100 à x=400 (largeur 300)
    expect(beat0[0].region.x).toBe(100);
    expect(beat0[0].region.width).toBe(300);
  });
});

describe("wholeImageRegion", () => {
  it("couvre toute l'image", () => {
    expect(wholeImageRegion(3, SIZE)).toEqual({
      beatIndex: 3,
      x: 0,
      y: 0,
      width: 1536,
      height: 1024,
    });
  });
});

describe("snapToSubject", () => {
  // Les deux sujets d'une vraie illustration : le grain, et la flamme.
  const grain = { x: 309, y: 201, width: 426, height: 574 };
  const flamme = { x: 1011, y: 361, width: 210, height: 330 };

  it("ramene un rectangle devine sur le sujet qu'il recouvre", () => {
    // Ce que gpt-4o a rendu pour le temps de la flamme : decale de 200 px.
    const devine = { beatIndex: 1, x: 800, y: 300, width: 300, height: 500 };

    expect(snapToSubject(devine, [grain, flamme])).toEqual({
      beatIndex: 1,
      ...flamme,
    });
  });

  it("choisit le sujet le plus recouvert quand deux sont touches", () => {
    const devine = { beatIndex: 0, x: 320, y: 210, width: 900, height: 400 };

    expect(snapToSubject(devine, [grain, flamme])).toMatchObject({ x: grain.x });
  });

  it("garde le numero du temps, qui porte l'appariement", () => {
    const devine = { beatIndex: 3, x: 1020, y: 370, width: 10, height: 10 };

    expect(snapToSubject(devine, [grain, flamme]).beatIndex).toBe(3);
  });

  it("prend le sujet le plus proche quand le modele a vise le papier vide", () => {
    const devine = { beatIndex: 0, x: 1300, y: 400, width: 40, height: 40 };

    expect(snapToSubject(devine, [grain, flamme])).toMatchObject({ x: flamme.x });
  });

  it("retaille un sujet ou deux choses ont fusionne", () => {
    // Le grain de cafe touche les lignes de la table : la mesure rendait les
    // trois comme un seul objet, large et plat.
    const grainEtTable = { x: 118, y: 393, width: 1165, height: 378 };
    const devine = { beatIndex: 0, x: 480, y: 380, width: 420, height: 340 };

    expect(snapToSubject(devine, [grainEtTable])).toEqual({
      beatIndex: 0,
      x: 480,
      y: 393,
      width: 420,
      height: 327,
    });
  });

  it("garde le sujet mesure quand il parle bien du meme objet", () => {
    // La tasse : mesuree 669x760, devinee 640x475. Meme objet, donc la mesure
    // gagne — elle seule connait les bords exacts.
    const tasse = { x: 449, y: 100, width: 669, height: 760 };
    const devine = { beatIndex: 0, x: 460, y: 275, width: 640, height: 475 };

    expect(snapToSubject(devine, [tasse])).toEqual({ beatIndex: 0, ...tasse });
  });

  it("laisse passer le rectangle devine quand l'image n'a rendu aucun sujet", () => {
    const devine = { beatIndex: 0, x: 10, y: 20, width: 30, height: 40 };

    expect(snapToSubject(devine, [])).toEqual(devine);
  });
});

describe("snapRegionsToSubjects", () => {
  it("preserve deux regions distinctes de la vision face a un candidat fusionne", () => {
    // Deux sujets distincts : par exemple un grain a gauche et une flamme a droite.
    const regions = [
      { beatIndex: 0, label: "Grain", x: 100, y: 100, width: 150, height: 150 },
      { beatIndex: 0, label: "Flamme", x: 300, y: 100, width: 150, height: 150 },
    ];
    // La mesure a fusionne les deux en un seul grand bloc connecte
    const candidats = [{ x: 90, y: 90, width: 380, height: 180 }];

    const snapped = snapRegionsToSubjects(regions, candidats);

    // L'anti-collision detecte que le snap les aurait ecrasees et conserve les
    // deux rectangles separes de la vision
    expect(snapped[0].x).toBe(100);
    expect(snapped[1].x).toBe(300);
  });
});

describe("buildVisionPrompt", () => {
  const prompt = buildVisionPrompt({ scene, size: SIZE });

  it("numerote les temps pour qu'ils soient apparies", () => {
    expect(prompt).toContain("0. Le levain est une culture vivante.");
    expect(prompt).toContain("1. Il donne au pain son gout acidule.");
  });

  it("rappelle les dimensions de cette image", () => {
    expect(prompt).toContain("1536 wide");
    expect(prompt).toContain("1024 tall");
  });

  it("demande une zone par SUJET dessine, pas une par temps", () => {
    // Une phrase qui nomme trois choses n'en faisait dessiner qu'une, cadree
    // si large qu'elle couvrait le reste.
    expect(prompt).toContain("ONE REGION PER DRAWN SUBJECT");
    expect(prompt).toContain("gets several regions");
  });

  it("demande une etiquette courte pour chaque zone", () => {
    expect(prompt).toContain("three words at most");
  });

  it("exige d'englober le sujet entier, pas un point pose dessus", () => {
    // Sans ces deux regles, la vision rendait des carres de 2 a 5 % de
    // l'image au milieu du sujet : le stylo ne dessinait presque rien.
    expect(prompt).toContain("ENCLOSE THE WHOLE SUBJECT");
    expect(prompt).toContain("never a point on the subject");
  });

  it("exige d'englober les etiquettes manuscrites et connecteurs adjacents", () => {
    expect(prompt).toContain("INCLUDE ADJACENT LABELS AND CONNECTORS");
    expect(prompt).toContain("Never cut between a subject and its label");
  });

  it("ordonne les regions selon l'ordre chronologique de narration", () => {
    expect(prompt).toContain("Order regions in the chronological order");
  });
});

describe("annotationPlanSchema", () => {
  it("accepte une reponse de vision", () => {
    expect(() =>
      annotationPlanSchema.parse({
        regions: [{ beatIndex: 0, x: 1, y: 2, width: 3, height: 4 }],
      }),
    ).not.toThrow();
  });

  it("refuse une reponse vide", () => {
    expect(() => annotationPlanSchema.parse({ regions: [] })).toThrow();
  });
});
