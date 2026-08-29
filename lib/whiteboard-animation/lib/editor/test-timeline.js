#!/usr/bin/env node
/**
 * Verification deterministe de la piste de montage, sans navigateur.
 *
 * Elle remplace une mesure faite a la main dans Chrome : curseur echantillonne
 * a chaque frame, on cherche un recul, un gel, et l'ecart entre la tete de
 * lecture et le bord de la carte au moment du fondu. La mesure manuelle
 * dependait d'une fenetre visible — Chrome gele requestAnimationFrame des que
 * l'onglet passe en arriere-plan, et la mesure devenait impossible. Ici
 * l'horloge est virtuelle : meme scenario, resultat reproductible, et ca tourne
 * dans `npm test`.
 *
 *   node lib/editor/test-timeline.js
 */
const assert = require('assert');

// ── Horloge, rAF et setTimeout virtuels ────────────────────────────────────
// L'horloge ne part PAS de zero : `_tlDebutScene` est teste par sa verite, et
// un depart a 0 le rendrait falsy — aucune duree ne serait mesuree. Un vrai
// performance.now() ne vaut jamais 0 non plus.
const horloge = { t: 1000 };
let rafs = [];
let minuteries = [];
globalThis.performance = { now: () => horloge.t };
globalThis.requestAnimationFrame = (cb) => { rafs.push(cb); return rafs.length; };
globalThis.cancelAnimationFrame = () => {};
// Le fondu d'une scene ANNOTEE attend son `to` par setTimeout : sans horloge
// virtuelle dessus, la lecture s'arretait a la deuxieme scene.
globalThis.setTimeout = (cb, ms) => {
  minuteries.push({ cb, quand: horloge.t + (ms || 0) });
  return minuteries.length;
};
globalThis.clearTimeout = () => {};

const FRAME = 1000 / 60;
function frame() {
  horloge.t += FRAME;
  const dues = minuteries.filter((m) => m.quand <= horloge.t);
  minuteries = minuteries.filter((m) => m.quand > horloge.t);
  dues.forEach((m) => m.cb());
  const aJouer = rafs; rafs = [];
  aJouer.forEach((cb) => cb(horloge.t));
}

const { createTimeline } = require('./Timeline');

// ── Le scenario ────────────────────────────────────────────────────────────
// Trois scenes. La 2e est ANNOTEE (duree ECRITE de 1800 ms, le dessin doit s'y
// plier). Les 1re et 3e n'ont qu'une estimation de carte a 3000 ms alors que
// leur dessin dure bien moins : c'est le passage estimation -> mesure, celui
// qui faisait sauter les cartes. La 3e DEPASSE sa carte au 2e passage, le cas
// exact qui produisait un recul de 11,8 % quand la marge de projection
// existait encore.
function scenario(dessinMs) {
  const scenes = [
    { id: 's1', annotations: [], transition: { transitionAfter: 'fade', transitionMs: 600 } },
    { id: 's2', annotations: [{ id: 'a', reveal: { from: 0, to: 1800 } }],
      transition: { transitionAfter: 'fade', transitionMs: 350 } },
    { id: 's3', annotations: [], transition: {} },
  ];
  const projet = {
    scenes: () => scenes,
    sceneLayer: (sc) => ({ annotations: sc.annotations }),
    courant: () => ({ scenes, narration: null }),
    choisir: (i) => { moteur.state.sceneIndex = i; },
  };

  const releve = { ratios: [], fondus: [], recul: 0, gelMax: 0 };
  let dernier = null, gel = 0;

  const moteur = {
    state: { canvasW: 640, canvasH: 360, playing: false, scenes },
    ctxPrincipal: { save() {}, restore() {}, drawImage() {} },
    ctxHand: { clearRect() {} },
    fillBg() {}, setProgress() {}, animate() {}, basculerPause() {},
    demarrer() {
      // le dessin de la scene courante commencera maintenant
      moteur.state.playing = true;
      moteur.state._tlDebutScene = horloge.t;
      finDuDessin = horloge.t + dessinMs[moteur.state.sceneIndex ?? 0];
    },
    transitionCanvas(ms, i, pendant, apres) {
      const b = tl.state._tlPlan.scenes[i];
      const total = tl.state._tlPlan.totalMs;
      releve.fondus.push({
        i,
        tete: +(((releve.ratios[releve.ratios.length - 1] ?? 0)) * 100).toFixed(2),
        bordCarte: +((b.endMs / total) * 100).toFixed(2),
      });
      moteur.state._tlEnTransition = true;
      pendant();
      horloge.t += ms;                    // le fondu consomme son temps
      moteur.state._tlEnTransition = false;
      apres();
    },
  };

  let finDuDessin = Infinity;

  const tl = createTimeline({
    engine: moteur, projet,
    hooks: {
      onPlayhead: (r) => {
        if (r == null || r < 0) return;
        if (dernier !== null) {
          const d = r - dernier;
          if (d < releve.recul) releve.recul = d;
          if (Math.abs(d) < 1e-9) { gel++; if (gel > releve.gelMax) releve.gelMax = gel; } else gel = 0;
        }
        dernier = r; releve.ratios.push(r);
      },
    },
  });

  tl.lire();
  // On fait tourner la lecture frame par frame, en declenchant la fin du
  // dessin de chaque scene a l'instant prevu — c'est ce que fait finishAnim().
  for (let n = 0; n < 4000 && moteur.state._lectureProjet; n++) {
    frame();
    if (horloge.t >= finDuDessin) {
      finDuDessin = Infinity;
      moteur.state.playing = false;
      tl.enchainerScene();
    }
  }
  return { releve, tl, scenes };
}

let echecs = 0;
function test(nom, fn) {
  try { fn(); console.log('  ok  ' + nom); }
  catch (e) { echecs++; console.log('  ECHEC ' + nom + '\n      ' + e.message); }
}

console.log('\n▸ Piste de montage — curseur, cartes et fondus');

// Passage 1 : cartes a l'estimation (3000 ms) pour des dessins bien plus courts
const p1 = scenario([1450, 1800, 1400]);

test('le curseur ne recule JAMAIS', () => {
  assert.ok(p1.releve.recul === 0,
    `recul de ${(p1.releve.recul * 100).toFixed(2)} % — la marge de projection est revenue ?`);
});

test('le curseur ne se fige pas', () => {
  assert.ok(p1.releve.gelMax <= 3, `${p1.releve.gelMax} frames consecutives immobiles`);
});

test('la lecture va au bout et enchaine les deux fondus', () => {
  assert.strictEqual(p1.releve.fondus.length, 2,
    `${p1.releve.fondus.length} fondu(s) au lieu de 2`);
});

test('au fondu, la tete est sur le bord de la carte (< 1 %)', () => {
  p1.releve.fondus.forEach((f) => {
    const ecart = Math.abs(f.tete - f.bordCarte);
    assert.ok(ecart < 1,
      `fondu ${f.i} : tete ${f.tete} % contre bord ${f.bordCarte} %, ecart ${ecart.toFixed(2)} %`);
  });
});

test('la scene ANNOTEE garde la duree ecrite, les autres sont mesurees', () => {
  const [a, b, c] = p1.scenes.map((s) => s._dureeMs);
  assert.ok(Math.abs(a - 1450) < 60, `scene 1 mesuree a ${a} ms, attendu ~1450`);
  assert.ok(Math.abs(c - 1400) < 60, `scene 3 mesuree a ${c} ms, attendu ~1400`);
  const plan = p1.tl.planCalcule();
  assert.strictEqual(Math.round(plan.scenes[1].dureeMs), 1800,
    'la scene annotee doit garder les 1800 ms de son `to`');
});

// Passage 2 : la DERNIERE scene deborde sa carte. C'est le cas qui produisait
// le saut arriere de 11,8 % tant que la marge de projection subsistait.
const p2 = scenario([1450, 1800, 3200]);

test('la derniere scene peut deborder sans faire reculer le curseur', () => {
  assert.ok(p2.releve.recul === 0,
    `recul de ${(p2.releve.recul * 100).toFixed(2)} % sur un depassement de la derniere scene`);
});

console.log(echecs ? `\n${echecs} ECHEC(S)\n` : '\nTout ok\n');
process.exit(echecs ? 1 : 0);
