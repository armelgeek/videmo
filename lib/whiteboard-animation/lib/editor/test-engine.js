#!/usr/bin/env node
/**
 * Le moteur de dessin, sur plusieurs calques, sans navigateur.
 *
 * Une scene a UN calque ne revele presque rien : c'est le cas ou la file de
 * calques a un seul element, et ou la plupart des erreurs d'indexation se
 * taisent. Ces tests montent donc des scenes a deux et trois calques.
 *
 *   node lib/editor/test-moteur.js
 */
const assert = require('assert');
const { installerDOM, imageCarree, encre } = require('./harnais-headless');

const W = 400, H = 200;
const h = installerDOM(W, H);
const { createEditorEngine } = require('./EditorEngine');

/** Trois bandes verticales disjointes : chaque calque a sa zone a lui. */
function moteurAvecCalques(ordres) {
  const main = document.createElement('canvas');
  const hand = document.createElement('canvas');
  const sel  = document.createElement('canvas');
  const largeur = Math.floor(W / ordres.length);
  const layers = ordres.map((ordre, i) => ({
    id: i + 1, img: imageCarree(largeur - 20, 160, '#111'),
    x: i * largeur + 10, y: 20, w: largeur - 20, h: 160,
    visible: true, opacity: 1, animStyle: 'contour', animOrder: ordre,
  }));
  const moteur = createEditorEngine({
    canvases: { main, hand, sel, wrapper: null },
    state: { canvasW: W, canvasH: H, animStyle: 'contour', speed: 40, handSpeed: 6, layers },
  });
  const zone = (i) => encre(main, i * largeur, 0, largeur, H);
  return { moteur, main, zone, nb: ordres.length };
}

let echecs = 0;
function test(nom, fn) {
  try { fn(); console.log('  ok  ' + nom); }
  catch (e) { echecs++; console.log('  ECHEC ' + nom + '\n      ' + e.message); }
}

console.log('\n▸ Moteur — scenes a plusieurs calques');

test('trois calques, trois groupes : les trois sont dessines', () => {
  const { moteur, zone } = moteurAvecCalques([1, 2, 3]);
  moteur.demarrer();
  h.jouer(() => false, 3000);
  [0, 1, 2].forEach((i) => {
    assert.ok(zone(i) > 1000, `le calque ${i + 1} n'est pas dessine (encre ${zone(i)})`);
  });
});

test('le groupe avance jusqu\'au dernier', () => {
  const { moteur } = moteurAvecCalques([1, 2, 3]);
  moteur.demarrer();
  h.jouer(() => false, 3000);
  assert.strictEqual(moteur.state._groupPos, 2,
    `arret sur le groupe ${moteur.state._groupPos} au lieu du 3e`);
});

test('la file de calques suit le groupe en cours', () => {
  // _queuePos restait a 0 pour toute la scene : getCurrentLayer() renvoyait
  // toujours le premier calque, et preRender() ne cuisait jamais les calques
  // deja finis dans le fond.
  const { moteur } = moteurAvecCalques([1, 2, 3]);
  moteur.demarrer();
  h.jouer(() => false, 3000);
  assert.strictEqual(moteur.state._queuePos, 2,
    `_queuePos vaut ${moteur.state._queuePos}, attendu 2 sur le dernier groupe`);
});

test('le dernier groupe ne se rejoue pas en boucle', () => {
  // finishAnim calculait nextPos depuis _queuePos, toujours 0, donc toujours 1 :
  // une scene a deux calques relançait indefiniment son deuxieme groupe.
  const { moteur, zone } = moteurAvecCalques([1, 2]);
  moteur.demarrer();
  h.jouer(() => false, 1200);
  const apresFin = [zone(0), zone(1)];
  h.jouer(() => false, 1200);   // on laisse tourner bien au-dela
  assert.deepStrictEqual([zone(0), zone(1)], apresFin,
    'le dessin a change apres la fin : un groupe a ete rejoue');
  assert.ok(moteur.state.done, 'la scene devrait etre finie et le rester');
});

test('les calques d\'un MEME groupe avancent ensemble', () => {
  // C'etait la promesse de `animOrder` : meme numero, meme instant. Elle
  // n'etait pas tenue — seul le dernier calque du groupe s'animait, les autres
  // apparaissaient d'un coup au composite de fin.
  const { moteur, zone } = moteurAvecCalques([1, 1]);
  moteur.demarrer();
  const releve = [];
  for (let n = 0; n < 200; n++) { h.frame(); if (n % 40 === 39) releve.push([zone(0), zone(1)]); }
  const enCours = releve.filter(([a, b]) => a > 0 && b > 0 && (a < 20000 || b < 20000));
  assert.ok(enCours.length >= 2,
    `les deux calques ne progressent jamais ensemble : ${JSON.stringify(releve)}`);
  // deux images identiques, meme style : le trace doit etre au meme point
  enCours.forEach(([a, b]) => {
    const ecart = Math.abs(a - b) / Math.max(a, b);
    assert.ok(ecart < 0.2, `traces desynchronises : ${a} contre ${b}`);
  });
});

test('un groupe de deux calques ne dure pas deux animations', () => {
  const seul = moteurAvecCalques([1]);
  seul.moteur.demarrer();
  let f1 = 0; while (f1 < 2000 && !seul.moteur.state.done) { h.frame(); f1++; }
  const paire = moteurAvecCalques([1, 1]);
  paire.moteur.demarrer();
  let f2 = 0; while (f2 < 2000 && !paire.moteur.state.done) { h.frame(); f2++; }
  assert.ok(f2 < f1 * 1.5,
    `deux calques simultanes prennent ${f2} frames contre ${f1} pour un seul — c'est du sequentiel`);
});

test('aucune clef d\'etat des styles n\'echappe au classement', () => {
  // Une clef ni per-slot ni per-scene reste partagee sans qu'on le sache, et
  // deux calques d'un meme groupe se marchent dessus. C'est ce qui rendait le
  // parallelisme inoperant : _SLOT_KEYS etait une liste VIDE.
  const fs = require('fs'), path = require('path');
  const { _SLOT_KEYS, _CLES_SCENE } = require('./EditorEngine');
  const dir = path.join(__dirname, '..', 'styles');
  const src = fs.readdirSync(dir).filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n')
    + fs.readFileSync(path.join(__dirname, '..', 'Animation.js'), 'utf8');
  const lues = new Set([...src.matchAll(/state\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
  const connues = new Set([..._SLOT_KEYS, ..._CLES_SCENE]);
  const orphelines = [...lues].filter((k) => !connues.has(k));
  assert.deepStrictEqual(orphelines, [],
    `clef(s) d'etat non classees : ${orphelines.join(', ')} — a mettre dans _SLOT_KEYS ou _CLES_SCENE`);
});

console.log(echecs ? `\n${echecs} ECHEC(S)\n` : '\nTout ok\n');
process.exit(echecs ? 1 : 0);
