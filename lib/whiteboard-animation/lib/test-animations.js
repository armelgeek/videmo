#!/usr/bin/env node
/**
 * Suite de non-regression des animations (lib/).
 *
 *   node lib/test-animations.js
 *
 * Couvre les invariants etablis en corrigeant le mode annotation-aware.
 * Chaque suite est ecrite pour ECHOUER si la logique correspondante casse :
 * une assertion qui passe aussi bien avec qu'sans le correctif ne vaut rien.
 */
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname);

// ─────────────────────────────────────────────────────────────
// Stubs canvas
// ─────────────────────────────────────────────────────────────

// Le stub peint des pixels opaques : avec une image blanche les presence maps
// sont vides, les styles n'ont aucun point a tracer et sautent leurs phases
// sans que rien ne le signale.
const CONTENU = (w, h) => {
  const n = Math.max(1, w * h), d = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) { d[i*4] = 20; d[i*4+1] = 20; d[i*4+2] = 20; d[i*4+3] = 255; }
  return { data: d, width: w, height: h };
};

/**
 * @param {object} opts.track  si fourni : {W,H,painted:Uint8Array} pour suivre
 *                             quels pixels sont reellement peints, en respectant
 *                             le clip courant.
 */
function mkCtx(opts = {}) {
  const t = opts.track;
  const c = { _stack: [], _clip: null, _rect: null, calls: { drawImage: 0, fillRect: 0 } };
  const dansClip = (x, y) => !c._clip ||
    (x >= c._clip.x && x < c._clip.x + c._clip.w && y >= c._clip.y && y < c._clip.y + c._clip.h);
  const peindre = (dx, dy, dw, dh) => {
    if (!t) return;
    for (let y = Math.floor(dy); y < dy + dh; y++)
      for (let x = Math.floor(dx); x < dx + dw; x++) {
        if (x < 0 || y < 0 || x >= t.W || y >= t.H) continue;
        if (!dansClip(x, y)) continue;
        t.painted[y * t.W + x] = 1;
      }
  };
  Object.assign(c, {
    save() { c._stack.push(c._clip); },
    restore() { c._clip = c._stack.pop() ?? null; },
    beginPath() { c._rect = null; },
    rect(x, y, w, h) { c._rect = { x, y, w, h }; },
    clip() { if (c._rect) c._clip = c._rect; },
    drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
      c.calls.drawImage++;
      if (dx !== undefined) peindre(dx, dy, dw, dh);
    },
    fillRect(x, y, w, h) { c.calls.fillRect++; },
    moveTo(){}, lineTo(){}, stroke(){}, arc(){}, fill(){}, closePath(){},
    quadraticCurveTo(){}, clearRect(){}, translate(){}, rotate(){}, scale(){},
    setTransform(){}, putImageData(){},
    createImageData: (w, h) => CONTENU(w, h),
    getImageData: (x, y, w, h) => CONTENU(w, h),
    set filter(v){}, get filter(){ return 'none'; },
    set globalAlpha(v){}, get globalAlpha(){ return 1; },
    set fillStyle(v){}, get fillStyle(){ return '#000'; },
    set strokeStyle(v){}, get strokeStyle(){ return '#000'; },
    set lineWidth(v){}, get lineWidth(){ return 1; },
    set lineCap(v){}, get lineCap(){ return 'butt'; },
    set lineJoin(v){}, get lineJoin(){ return 'miter'; },
  });
  return c;
}
global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => mkCtx() }) };

const { AnimationFactory } = require(ROOT);
const AnnotationManager = require(path.join(ROOT, 'AnnotationManager'));

const STYLES = [
  'scanner','contour','outlinechunks','chunkjump','outlinefill','nervous','topanchor',
  'scribble','gesture','illustfill','outlineonly','spec-text',
  'spec-human','spec-animal','spec-portrait','spec-vehicle','spec-building',
  'spec-landscape','spec-spiral','spec-nature','spec-explode','specialized',
];

const W = 1600, H = 900, FRAME = 16.67;
// deux regions qui se CHEVAUCHENT : c'est le cas qui a fait perdre des pixels
const REGIONS = () => ([
  { region: { x: 100, y: 75,  width: 680, height: 205 }, reveal: { startMs: 0,    durationMs: 1600, maskPaddingPx: 22 } },
  { region: { x: 600, y: 200, width: 400, height: 300 }, reveal: { startMs: 1600, durationMs: 1000, maskPaddingPx: 22 } },
]);
const TIMELINE_MS = 2600;
const BUDGET = Math.round(TIMELINE_MS / FRAME);

function mkState(over = {}) {
  return Object.assign({
    contentBounds: { x: 0, y: 0, w: W, h: H }, canvasW: W, canvasH: H,
    zigzag: true, handSpeed: 6, speed: 40, tileSlider: 30,
    textDrawStyle: 'outline-fill',      // mode multi-phases de spec-text
    annotations: REGIONS(),
  }, over);
}

function run(style, state, { track } = {}) {
  const ctx = mkCtx({ track });
  let finishCount = 0;
  const a = AnimationFactory.create(style, {
    state, ctx, hctx: mkCtx(), offscreen: { getContext: () => mkCtx(), width: W, height: H },
    callbacks: {
      fillBg(c) { c.fillRect(0, 0, W, H); },   // fillBg peint : respecte le clip
      drawHand(){}, setProgress(p) { state._p = p; },
      finishAnim() { finishCount++; }, resScale: () => 1, resPointScale: () => 1,
    },
  });
  a.setup();
  const PHASE_KEYS = ['contourPhase','outlineChunksPhase','ofPhase','ifPhase','stPhase'];
  const phases = new Set();
  let frames = 0;
  const cap = state.annotations.length ? BUDGET * 4 : 60000;
  while (!finishCount && frames < cap) {
    frames++;
    a.tick(state.speed, FRAME);
    const k = PHASE_KEYS.find(k => state[k] !== undefined);
    if (k) phases.add(state[k]);
  }
  return { anim: a, ctx, frames, finishCount, phases: [...phases].sort(), fini: frames < cap };
}

// ─────────────────────────────────────────────────────────────
// Mini harness
// ─────────────────────────────────────────────────────────────
let ok = 0; const echecs = [];
const suite = (nom, fn) => { console.log(`\n▸ ${nom}`); fn(); };
const test = (nom, fn) => {
  try { fn(); ok++; console.log(`  ✓ ${nom}`); }
  catch (e) { echecs.push([nom, e.message]); console.log(`  ✗ ${nom}\n      ${e.message}`); }
};

// ─────────────────────────────────────────────────────────────
suite('AnnotationManager — bornes from/to', () => {
  const mk = (anns) => {
    const m = Object.create(AnnotationManager.prototype);
    m.annotations = anns; m.elapsedMs = 0;
    m.schedule = m.buildSchedule();
    return m;
  };
  const B = (from, to) => ({ region:{x:0,y:0,width:10,height:10}, reveal:{ from, to } });
  const D = (durationMs) => ({ region:{x:0,y:0,width:10,height:10}, reveal:{ durationMs } });

  test('les bornes explicites font foi', () => {
    const m = mk([B(2950, 8500), B(8750, 13300)]);
    assert.deepStrictEqual(m.schedule.map(s => [s.startMs, s.endMs]),
      [[2950,8500],[8750,13300]]);
  });

  test('la duree se calcule, elle n\'est pas stockee', () => {
    assert.strictEqual(mk([B(1000, 3500)]).schedule[0].durationMs, 2500);
  });

  test('la pause est l\'ecart entre deux annotations', () => {
    const m = mk([B(0, 1000), B(1500, 2000)]);
    m.elapsedMs = 1200;
    assert.deepStrictEqual(m.tick(0), [], 'rien d\'actif dans l\'ecart');
  });

  test('un chevauchement est signale comme conflit', () => {
    const m = mk([B(0, 3000), B(2000, 4000)]);
    assert.ok(m.schedule[0].conflit, 'le trace ne tient pas avant la suivante');
    assert.ok(!m.schedule[1].conflit);
  });

  test('sans bornes : enchainement par durationMs', () => {
    const m = mk([D(1600), D(1000)]);
    assert.deepStrictEqual(m.schedule.map(s => [s.startMs, s.endMs]), [[0,1600],[1600,2600]]);
    assert.ok(!m.schedule[0].explicite);
  });

  test('bornes et durees peuvent cohabiter', () => {
    const m = mk([D(1000), B(5000, 6000), D(500)]);
    assert.deepStrictEqual(m.schedule.map(s => [s.startMs, s.endMs]),
      [[0,1000],[5000,6000],[6000,6500]], 'le repli reprend apres une borne');
  });

  test('fin de timeline et isFinished', () => {
    const m = mk([B(0, 1600), B(2000, 2600)]);
    assert.strictEqual(m.endMs(), 2600);
    m.elapsedMs = 2599; assert.ok(!m.isFinished());
    m.elapsedMs = 2600; assert.ok(m.isFinished());
  });

  test('to invalide est corrige plutot que de produire une duree nulle', () => {
    assert.strictEqual(mk([B(1000, 500)]).schedule[0].durationMs, 1);
  });
});

// ─────────────────────────────────────────────────────────────
suite('Rythme — le pacing suit le PLANNING, pas le durationMs ecrit', () => {
  // Depuis le passage aux bornes from/to, la duree REELLE d'une region est
  // to - from. Le durationMs ecrit par l'auteur peut en differer : se caler
  // dessus faisait tracer trop lentement quand la fenetre etait plus courte,
  // la region n'etait dessinee qu'aux deux tiers, puis _flushRegion la
  // tamponnait d'un coup. C'est le "pop" observe sur la scene de reference
  // (tag : ecrit 2000ms, fenetre 1300ms, trace a 72%).
  const A = (from, to, durationMs) => ({
    region: { x: 100, y: 75, width: 680, height: 205 },
    reveal: { from, to, durationMs, maskPaddingPx: 22 },
  });

  /** Budget de frames que le moteur accorde a la region active. */
  const budget = (annotations) => {
    const state = mkState({ annotations });
    const a = AnimationFactory.create('contour', {
      state, ctx: mkCtx(), hctx: mkCtx(),
      offscreen: { getContext: () => mkCtx(), width: W, height: H },
      callbacks: {
        fillBg(c) { c.fillRect(0, 0, W, H); }, drawHand() {}, setProgress() {},
        finishAnim() {}, resScale: () => 1, resPointScale: () => 1,
      },
    });
    a.setup();
    a.tick(state.speed, FRAME);
    return a._frames;
  };

  const attendu = (ms) => Math.round(ms / FRAME);

  test('fenetre plus COURTE que le durationMs ecrit : le trace accelere', () => {
    const f = budget([A(0, 1300, 2000)]);
    assert.strictEqual(f, attendu(1300),
      `pacing sur ${Math.round(f * FRAME)}ms au lieu des 1300ms accordes`);
  });

  test('fenetre plus LONGUE que le durationMs ecrit : le trace ralentit', () => {
    const f = budget([A(0, 2300, 1400)]);
    assert.strictEqual(f, attendu(2300),
      'le trace finirait tot et attendrait, main masquee');
  });

  test('sans bornes : le durationMs ecrit fait toujours foi', () => {
    const sansBornes = [{ region: { x: 100, y: 75, width: 680, height: 205 },
                          reveal: { durationMs: 1600, maskPaddingPx: 22 } }];
    assert.strictEqual(budget(sansBornes), attendu(1600));
  });

  test('le curseur Reveal speed comprime aussi ce budget', () => {
    const state = { annotations: [A(0, 1300, 2000)] };
    const rapide = mkState({ ...state, speed: 80 });   // 2x
    const a = AnimationFactory.create('contour', {
      state: rapide, ctx: mkCtx(), hctx: mkCtx(),
      offscreen: { getContext: () => mkCtx(), width: W, height: H },
      callbacks: { fillBg(c) { c.fillRect(0, 0, W, H); }, drawHand() {},
                   setProgress() {}, finishAnim() {}, resScale: () => 1,
                   resPointScale: () => 1 },
    });
    a.setup(); a.tick(rapide.speed, FRAME);
    assert.strictEqual(a._frames, attendu(1300 / 2), 'a 2x la region a moitie moins de frames');
  });
});

// ─────────────────────────────────────────────────────────────
suite('Projet multi-scene', () => {
  const { buildProjectSchedule, projectDurationMs, sceneA } = require(path.join(ROOT, 'project'));
  const R = (from, to) => ({ region:{ x:0,y:0,width:10,height:10 }, reveal:{ from, to } });
  const PROJET = () => ({
    narration: { audioUrl: 'data:audio/mp3;base64,AA' },
    scenes: [
      { id:'s1', annotations:[ R(0, 2000), R(2000, 5000) ],
        transition:{ transitionAfter:'slideup', transitionMs:500 } },
      { id:'s2', annotations:[ R(5000, 6500) ] },
    ],
  });

  test('les scenes partagent UNE horloge', () => {
    const p = buildProjectSchedule(PROJET());
    assert.strictEqual(p.scenes[0].startMs, 0);
    assert.strictEqual(p.scenes[1].startMs, 5000, 'la scene 2 poursuit l\'horloge globale');
  });

  test('la transition a sa propre duree : la suivante attend', () => {
    // sans bornes explicites, la scene entrante ne demarre qu'apres le fondu
    const sansBornes = { scenes: [
      { id:'s1', annotations:[ { region:{x:0,y:0,width:10,height:10}, reveal:{ durationMs:2000 } } ],
        transition:{ transitionAfter:'slideup', transitionMs:500 } },
      { id:'s2', annotations:[ { region:{x:0,y:0,width:10,height:10}, reveal:{ durationMs:1000 } } ] },
    ]};
    const p = buildProjectSchedule(sansBornes);
    assert.strictEqual(p.scenes[0].endMs, 2000);
    assert.strictEqual(p.scenes[1].startMs, 2500, 'la scene 2 demarre apres le fondu');
  });

  test('la duree du projet est le dernier `to`', () => {
    assert.strictEqual(projectDurationMs(PROJET()), 6500);
  });

  test('une scene couvre ses regions meme rangees dans le desordre', () => {
    // Le tableau d'annotations n'est PAS trie par le temps : deplacer une
    // region sur la timeline, ou saisir Debut/Fin dans l'inspecteur, suffit a
    // le desordonner. Prendre schedule[0] amputait la scene de tout ce qui
    // precede la premiere du tableau — duree fausse en preview ET a l'export.
    const desordre = { scenes: [ { id:'s1', annotations:[ R(4800, 5700), R(498, 1998), R(1800, 2700) ] } ] };
    const p = buildProjectSchedule(desordre);
    assert.strictEqual(p.scenes[0].startMs, 498, 'debut = la region la plus tot');
    assert.strictEqual(p.scenes[0].endMs, 5700, 'fin = la region la plus tard');
    assert.strictEqual(p.scenes[0].dureeMs, 5202);
  });

  test('la transition est portee, pas ignoree', () => {
    const p = buildProjectSchedule(PROJET());
    assert.strictEqual(p.scenes[0].transitionAfter, 'slideup');
    assert.strictEqual(p.scenes[0].transitionMs, 500);
    assert.strictEqual(p.scenes[1].transitionMs, 0, 'pas de transition apres la derniere');
  });

  test('sceneA donne la scene affichee a l\'instant t', () => {
    const p = buildProjectSchedule(PROJET());
    assert.strictEqual(sceneA(p, 100).scene.id, 's1');
    assert.strictEqual(sceneA(p, 4999).scene.id, 's1');
    assert.strictEqual(sceneA(p, 5000).scene.id, 's2');
  });

  test('les conflits remontent avec leur scene', () => {
    const p = buildProjectSchedule({ scenes: [
      { id:'s1', annotations:[ R(0, 4000), R(2000, 5000) ] } ]});
    assert.ok(p.conflits.length > 0);
    assert.strictEqual(p.conflits[0].scene, 0);
  });

  test('projet vide : duree nulle, pas de plantage', () => {
    assert.strictEqual(projectDurationMs({ scenes: [] }), 0);
    assert.strictEqual(projectDurationMs({}), 0);
    assert.strictEqual(projectDurationMs(null), 0);
  });
});

// ─────────────────────────────────────────────────────────────
suite('Transitions', () => {
  const { resoudreTransition, nomsTransitions, TRANSITIONS } = require(path.join(ROOT, 'transitions'));

  test('le catalogue couvre cut, fade et les slides', () => {
    const noms = nomsTransitions();
    ['cut', 'fade', 'slideup', 'slidedown', 'slideleft', 'slideright']
      .forEach(n => assert.ok(noms.includes(n), `${n} manquante`));
  });

  test('un nom inconnu retombe sur le fondu plutot que de planter', () => {
    assert.strictEqual(resoudreTransition('zoomwarp'), TRANSITIONS.fade);
  });

  test('none et absence donnent null : aucune transition', () => {
    assert.strictEqual(resoudreTransition('none'), null);
    assert.strictEqual(resoudreTransition(null), null);
    assert.strictEqual(resoudreTransition(''), null);
  });

  test('fade : l\'entrante gagne en opacite avec t', () => {
    const vus = [];
    const ctx = { drawImage(){}, save(){}, restore(){},
                  set globalAlpha(v) { vus.push(v); }, get globalAlpha() { return 1; } };
    TRANSITIONS.fade(ctx, 'A', 'B', 0.25, 100, 100);
    TRANSITIONS.fade(ctx, 'A', 'B', 0.75, 100, 100);
    assert.deepStrictEqual(vus, [0.25, 0.75]);
  });

  test('slideup : les deux images se decalent ensemble', () => {
    const pos = [];
    const ctx = { drawImage: (img, x, y) => pos.push([img, x, y]), save(){}, restore(){},
                  set globalAlpha(v){}, get globalAlpha(){ return 1; } };
    TRANSITIONS.slideup(ctx, 'A', 'B', 0.5, 100, 200);
    assert.deepStrictEqual(pos, [['A', 0, -100], ['B', 0, 100]],
      'la sortante monte, l\'entrante arrive par le bas');
  });

  test('cut : pas de melange, bascule a mi-parcours', () => {
    const vus = [];
    const ctx = { drawImage: (img) => vus.push(img), save(){}, restore(){},
                  set globalAlpha(v){}, get globalAlpha(){ return 1; } };
    TRANSITIONS.cut(ctx, 'A', 'B', 0.4, 10, 10);
    TRANSITIONS.cut(ctx, 'A', 'B', 0.6, 10, 10);
    assert.deepStrictEqual(vus, ['A', 'B']);
  });
});

// ─────────────────────────────────────────────────────────────
suite('Region par region', () => {
  const vus = [];
  class Fake extends require(path.join(ROOT, 'Animation')) {
    setup() { const b = this.state.contentBounds; vus.push(`${b.x},${b.y},${b.w}x${b.h}`); }
    tick(d) { this.withAnnotationAwareness(d, () => {}); }
  }
  const state = mkState();
  const ctx = mkCtx();
  let fin = 0;
  const a = new Fake({ state, ctx, hctx: mkCtx(), offscreen: { getContext: () => mkCtx() },
    callbacks: { finishAnim: () => fin++ } });
  a.setup();
  for (let i = 0; i < BUDGET + 5; i++) a.tick(FRAME);

  test('setup initial sur l\'image entiere', () => assert.strictEqual(vus[0], `0,0,${W}x${H}`));
  test('setup relance sur la region 0', () => assert.strictEqual(vus[1], '100,75,680x205'));
  test('setup relance sur la region 1', () => assert.strictEqual(vus[2], '600,200,400x300'));
  test('un seul setup par region (pas par frame)', () => assert.strictEqual(vus.length, 3));
  test('contentBounds restaure a la fin', () =>
    assert.deepStrictEqual(state.contentBounds, { x: 0, y: 0, w: W, h: H }));
  test('finishAnim appele exactement une fois', () => assert.strictEqual(fin, 1));
});

// ─────────────────────────────────────────────────────────────
suite('Clip et flush portent sur le MEME rectangle', () => {
  // Invariant : une region ne doit jamais effacer une region deja dessinee.
  // Un clip elargi par maskPaddingPx efface une bande que le flush ne repeint
  // pas -> c'est ainsi que la region 1 perdait 2.84% de ses pixels.
  const state = mkState();
  const ctx = mkCtx();
  const rects = [];
  const A = require(path.join(ROOT, 'Animation'));
  class Fake extends A {
    setup() {}
    tick(d) { this.withAnnotationAwareness(d, () => { rects.push({ ...this.ctx._clip }); }); }
  }
  const a = new Fake({ state, ctx, hctx: mkCtx(), offscreen: { getContext: () => mkCtx() },
    callbacks: { finishAnim(){} } });
  a.setup();
  for (let i = 0; i < 20; i++) a.tick(FRAME);
  const r = REGIONS()[0].region;

  test('le clip est le rectangle STRICT (sans maskPaddingPx)', () =>
    assert.deepStrictEqual(rects[0], { x: r.x, y: r.y, w: r.width, h: r.height }));
});

// ─────────────────────────────────────────────────────────────
suite(`Rythme — les ${STYLES.length} styles suivent la timeline`, () => {
  for (const style of STYLES) {
    test(`${style}: termine avec la timeline (${BUDGET}f)`, () => {
      const r = run(style, mkState());
      assert.ok(r.fini, `n'a jamais termine (>${BUDGET * 4} frames)`);
      assert.ok(Math.abs(r.frames - BUDGET) <= 3,
        `${r.frames}f au lieu de ~${BUDGET}f`);
      assert.strictEqual(r.finishCount, 1, `finishAnim x${r.finishCount}`);
    });
  }
});

// ─────────────────────────────────────────────────────────────
suite('Phases — le stroke ne mange pas tout le budget', () => {
  // paceStep doit repartir les frames entre les phases, sinon la phase 1
  // consomme tout le durationMs et le remplissage/couleur n'a jamais lieu.
  for (const style of ['contour','outlinechunks','outlinefill','illustfill','outlineonly','spec-text']) {
    test(`${style}: traverse plusieurs phases`, () => {
      const r = run(style, mkState());
      assert.ok(r.phases.length >= 2,
        `bloque en phase ${r.phases.join(',')} - le stroke mange tout le budget`);
    });
  }
});

// ─────────────────────────────────────────────────────────────
suite('Equilibre des phases dans chaque region', () => {
  // Les valeurs derivees de setup() (totalPhases, nColors, contentBounds)
  // decrivent la region ACTIVE. Les lire en haut de tick() renvoie celles de
  // la region PRECEDENTE : paceStep cadence alors le balayage a la mauvaise
  // vitesse et une phase mange le budget de l'autre.
  const framesParPhase = (style, cle) => {
    const anns = REGIONS();
    const state = mkState({ annotations: anns });
    const ctx = mkCtx();
    let f = 0, fin = 0;
    const par = {};
    const a = AnimationFactory.create(style, { state, ctx, hctx: mkCtx(),
      offscreen: { getContext: () => mkCtx(), width: W, height: H },
      callbacks: { fillBg(){}, drawHand(){}, setProgress(){}, finishAnim(){ fin++; },
                   resScale: () => 1, resPointScale: () => 1 } });
    a.setup();
    while (!fin && f < BUDGET * 4) {
      f++; a.tick(40, FRAME);
      const idx = state._lastAnnotationIdx;
      if (idx === undefined) continue;
      par[idx] = par[idx] || {};
      par[idx][state[cle]] = (par[idx][state[cle]] || 0) + 1;
    }
    return par;
  };

  test('outlinefill: le trace et le balayage se partagent la region', () => {
    const par = framesParPhase('outlinefill', 'ofPhase');
    for (const [idx, ph] of Object.entries(par)) {
      const p1 = ph[1] || 0, p2 = ph[2] || 0;
      assert.ok(p1 > 0 && p2 > 0, `R${idx}: phase1=${p1}f phase2=${p2}f — une phase est sautee`);
      const ratio = Math.max(p1, p2) / Math.min(p1, p2);
      assert.ok(ratio < 3,
        `R${idx}: phase1=${p1}f phase2=${p2}f — partage desequilibre (x${ratio.toFixed(1)})`);
    }
  });

  test('contour: le trace et le remplissage se partagent la region', () => {
    const par = framesParPhase('contour', 'contourPhase');
    for (const [idx, ph] of Object.entries(par)) {
      assert.ok((ph[1] || 0) > 0 && (ph[2] || 0) > 0,
        `R${idx}: phase1=${ph[1]||0}f phase2=${ph[2]||0}f — une phase est sautee`);
    }
  });
});

// ─────────────────────────────────────────────────────────────
suite('Robustesse — region vide', () => {
  // Une region d'annotation peut ne contenir aucun dessin : les styles
  // derefaient pts[-1] et faisaient planter toute l'animation.
  for (const style of STYLES) {
    test(`${style}: region sans contenu ne plante pas`, () => {
      const state = mkState();
      const ctx = mkCtx();
      const a = AnimationFactory.create(style, {
        state, ctx, hctx: mkCtx(),
        // offscreen entierement transparent -> aucune presence
        offscreen: { getContext: () => Object.assign(mkCtx(), {
          getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w*h*4)), width: w, height: h }),
        }), width: W, height: H },
        callbacks: { fillBg(){}, drawHand(){}, setProgress(){}, finishAnim(){},
                     resScale: () => 1, resPointScale: () => 1 },
      });
      a.setup();
      for (let i = 0; i < 200; i++) a.tick(40, FRAME);   // ne doit pas lever
    });
  }
});

// ─────────────────────────────────────────────────────────────
suite('Legacy (sans annotation) — comportement animations.js preserve', () => {
  for (const style of STYLES) {
    test(`${style}: termine, sans crash ni boucle infinie`, () => {
      const r = run(style, mkState({ annotations: [] }));
      assert.ok(r.fini, 'boucle infinie : finishAnim jamais appele');
      assert.strictEqual(r.finishCount, 1, `finishAnim x${r.finishCount}`);
    });
  }
});

// ─────────────────────────────────────────────────────────────
suite('paceStep', () => {
  const A = require(path.join(ROOT, 'Animation'));
  const a = Object.create(A.prototype);
  test('legacy : renvoie le pas d\'origine intact', () => {
    a._frames = null;
    assert.strictEqual(a.paceStep(1000, 7), 7);
    assert.strictEqual(a.paceStep(1000, 3, 4), 3);
  });
  test('annotation : dimensionne pour finir dans le budget', () => {
    a._frames = 100;
    assert.strictEqual(a.paceStep(1000, 7), 10);   // 1000 pts / 100 frames
  });
  test('annotation : repartit le budget entre les phases', () => {
    a._frames = 100;
    assert.strictEqual(a.paceStep(1000, 7, 2), 20); // 2 phases -> 50 frames chacune
  });
  test('jamais zero', () => { a._frames = 10000; assert.ok(a.paceStep(1, 1) >= 1); });
});

// ─────────────────────────────────────────────────────────────
suite('Pause explicite : la main disparait', () => {
  // Pendant une pause l'utilisateur a demande un temps d'arret : le dessin
  // deja revele reste, mais la main ne doit pas rester figee sur le dernier
  // trait — elle ne dessine rien. Elle reapparait a l'annotation suivante.
  // l'ecart entre le `to` de la premiere et le `from` de la seconde EST la pause
  const anns = [
    { region: { x:100, y:75,  width:400, height:200 }, reveal: { from: 0,   to: 500 } },
    { region: { x:600, y:400, width:300, height:200 }, reveal: { from: 900, to: 1400 } },
  ];

  const mainParFrame = (style) => {
    const state = mkState({ annotations: JSON.parse(JSON.stringify(anns)) });
    let f = 0, fin = 0;
    const vue = [];
    const a = AnimationFactory.create(style, { state, ctx: mkCtx(), hctx: mkCtx(),
      offscreen: { getContext: () => mkCtx(), width: W, height: H },
      callbacks: { fillBg(){}, setProgress(){}, finishAnim(){ fin++; },
                   resScale: () => 1, resPointScale: () => 1,
                   drawHand() { vue[f] = 1; } } });
    a.setup();
    while (!fin && f < 500) { f++; a.tick(40, FRAME); }
    return { vue, frames: f };
  };

  for (const style of ['scanner', 'contour', 'chunkjump', 'outlineonly']) {
    test(`${style}: aucune main pendant la pause`, () => {
      const { vue } = mainParFrame(style);
      const pendant = [];
      for (let k = 1; k <= vue.length; k++) {
        const t = k * FRAME;
        if (t >= 500 && t < 900) pendant.push(!!vue[k]);
      }
      assert.ok(pendant.length > 0, 'la pause n\'a pas ete atteinte');
      assert.ok(!pendant.some(Boolean),
        `main dessinee sur ${pendant.filter(Boolean).length}/${pendant.length} frames de pause`);
    });
  }

  test('la main revient a l\'annotation suivante', () => {
    const { vue } = mainParFrame('scanner');
    let apres = 0;
    for (let k = 1; k <= vue.length; k++) if (k * FRAME >= 900 && vue[k]) apres++;
    assert.ok(apres > 0, 'la main ne reapparait pas apres la pause');
  });
});

// ─────────────────────────────────────────────────────────────
suite('La main dessine DANS la region active', () => {
  // Invariant : a chaque frame, la pointe du stylo doit se trouver dans le
  // rectangle de l'annotation en cours. Les styles qui lisaient contentBounds
  // en haut de tick() recevaient la region PRECEDENTE pendant une frame : la
  // main restait a l'ancien endroit a chaque changement de region (jusqu'a
  // 783px d'ecart, soit un teleport visible d'un bout a l'autre du canvas).
  // Tolerance : la pointe peut deborder du rectangle de quelques pixels
  // (centre de tuile, demi-bande de scan, rayon du trait).
  const TOLERANCE = 24;

  const ecartMax = (style) => {
    const anns = REGIONS();
    const state = mkState({ annotations: anns });
    let frame = 0, fin = 0, pire = 0, pireInfo = null;
    const a = AnimationFactory.create(style, { state, ctx: mkCtx(), hctx: mkCtx(),
      offscreen: { getContext: () => mkCtx(), width: W, height: H },
      callbacks: { fillBg(){}, setProgress(){}, finishAnim(){ fin++; },
        resScale: () => 1, resPointScale: () => 1,
        drawHand(h, x, y) {
          const t = frame * FRAME;
          const act = anns.find(an => t >= an.reveal.startMs &&
                                      t < an.reveal.startMs + an.reveal.durationMs);
          if (!act) return;                       // pause entre annotations
          const r = act.region;
          const dx = Math.max(r.x - x, x - (r.x + r.width), 0);
          const dy = Math.max(r.y - y, y - (r.y + r.height), 0);
          const d = Math.hypot(dx, dy);
          if (d > pire) { pire = d; pireInfo = { frame, t: Math.round(t), tip: [Math.round(x), Math.round(y)] }; }
        } } });
    a.setup();
    while (!fin && frame < BUDGET * 4) { frame++; a.tick(40, FRAME); }
    return { pire: Math.round(pire), info: pireInfo };
  };

  for (const style of STYLES) {
    test(`${style}: la pointe reste dans la region active`, () => {
      const { pire, info } = ecartMax(style);
      assert.ok(pire <= TOLERANCE,
        `pointe a ${pire}px hors region` + (info ? ` (frame ${info.frame}, t=${info.t}ms, tip ${info.tip})` : ''));
    });
  }
});

// ─────────────────────────────────────────────────────────────
suite('Projection des regions (parite frontend / backend)', () => {
  const { projectAnnotations, regionToCanvasRect } = require(ROOT);
  // region en pixels NATURELS de l'image, layer affiche ailleurs et redimensionne
  const layer = {
    x: 126, y: 112, w: 1536, h: 864,
    img: { naturalWidth: 768, naturalHeight: 432 },     // affiche a 2x
    annotations: [{ region: { x: 100, y: 50, width: 200, height: 100 },
                    reveal: { startMs: 0, durationMs: 1000 } }],
  };

  test('applique l\'echelle ET l\'offset du layer', () => {
    const r = regionToCanvasRect(layer, layer.annotations[0].region);
    assert.deepStrictEqual(r, { x: 126 + 200, y: 112 + 100, width: 400, height: 200 });
  });
  test('conserve les autres champs de l\'annotation', () => {
    const a = projectAnnotations(layer)[0];
    assert.strictEqual(a.reveal.durationMs, 1000);
  });
  test('ne mute pas l\'annotation d\'origine', () => {
    projectAnnotations(layer);
    assert.strictEqual(layer.annotations[0].region.x, 100);
  });
  test('tombe sur naturalWidth OU width (node-canvas n\'a pas naturalWidth)', () => {
    const nodeLayer = { ...layer, img: { width: 768, height: 432 } };
    assert.deepStrictEqual(regionToCanvasRect(nodeLayer, { x: 100, y: 50, width: 200, height: 100 }),
                           { x: 326, y: 212, width: 400, height: 200 });
  });
  test('layer sans annotation -> tableau vide', () => {
    assert.deepStrictEqual(projectAnnotations({ x:0,y:0,w:10,h:10 }), []);
    assert.deepStrictEqual(projectAnnotations(null), []);
  });
  test('ignore une annotation sans region', () => {
    assert.strictEqual(projectAnnotations({ ...layer, annotations: [{ reveal: {} }] }).length, 0);
  });
  test('le curseur Reveal speed atteint le backend', () => {
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    const back  = fs.readFileSync(path.join(ROOT, '..', 'server', 'canvas-renderer.js'), 'utf8');
    assert.ok(/speed:\s*parseInt\(document\.getElementById\('speed-slider'/.test(front),
      "generateExportData n'envoie pas speed : la video ignorerait le curseur");
    assert.ok(/speed:\s*animationData\.speed/.test(back),
      'window.state ne reprend pas speed : le backend rendrait toujours a 1x');
  });

  test('les scenes sont cablees dans l\'interface', () => {
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    assert.ok(/function ajouterScene/.test(front), 'pas de creation de scene');
    assert.ok(/function deplacerScene/.test(front), 'pas de reordonnancement');
    assert.ok(/function supprimerScene/.test(front), 'pas de suppression');
    assert.ok(/id="scene-list"/.test(front), 'pas de liste de scenes');
    assert.ok(/data-champ="transitionAfter"/.test(front), 'pas de choix de transition');
    assert.ok(/projectDurationMs\(projetCourant\(\)\)/.test(front),
      'la duree totale ne passe pas par lib/project');
  });

  test('basculer de scene masque les images des autres scenes', () => {
    // Le canvas empile TOUS les layers visibles : sans masquer ceux des
    // autres scenes, changer de scene ne changeait rien a l'ecran.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    assert.ok(/function _appliquerVisibiliteScene/.test(front), 'pas de gestion de visibilite');
    const bloc = front.slice(front.indexOf('function choisirScene'));
    const fn = bloc.slice(0, bloc.indexOf('\n/** Ouvre le selecteur'));
    assert.ok(/_appliquerVisibiliteScene\(\)/.test(fn), 'choisirScene n\'applique pas la visibilite');
    assert.ok(/redrawLayersOnCanvas\(\)/.test(fn), 'choisirScene ne redessine pas le canvas');
    // et une image doit pouvoir etre chargee directement depuis la carte Scenes
    assert.ok(/function chargerImageScene/.test(front), 'pas d\'import d\'image par scene');
    assert.ok(/_importImageScene\(\$\{i\}\)/.test(front), 'pas de bouton d\'import dans la carte');
    // addLayer doit rendre le layer, sinon on ne peut pas le rattacher
    assert.ok(/return layer;\s*\/\/ pour lier l'image a une scene/.test(front),
      'addLayer ne renvoie pas le layer cree');
  });

  test('les ids de layer en double sont reparables au chargement', () => {
    // Les projets enregistres avant le partage du compteur en contiennent :
    // une scene ne pourrait jamais designer le second layer.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    assert.ok(/function _dedupLayerIds/.test(front), 'pas de renumerotation des doublons');
    assert.ok(/_dedupLayerIds\(\);/.test(front), '_dedupLayerIds n\'est jamais appelee');
  });

  test('le compteur d\'ID de layer est partage entre les blocs <script>', () => {
    // Les scenes referencent un layerId : deux layers de meme id et elles
    // resolvent toutes vers le premier. Or le compteur est resynchronise au
    // chargement d'un projet depuis un AUTRE bloc <script>, via window. Un
    // `let` de haut niveau ne cree pas de propriete sur window : la resynchro
    // ecrivait dans une seconde variable, le compteur repartait de 0, et la
    // premiere image ajoutee apres un rechargement reprenait un id deja pris.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    assert.ok(!/^\s*(let|const|var)\s+_layerIdCounter/m.test(front),
      '_layerIdCounter ne doit pas etre une variable de bloc');
    const refs = front.match(/[\w.]*_layerIdCounter/g) || [];
    assert.ok(refs.length >= 4, `seulement ${refs.length} references trouvees`);
    const nues = refs.filter(r => r === '_layerIdCounter');
    assert.strictEqual(nues.length, 0,
      `${nues.length} reference(s) hors window : elles viseraient une autre variable`);
  });

  test('une scene pointe un layer par ID, pas par reference', () => {
    // une reference d'objet ne survit pas au JSON de la sauvegarde : la scene
    // repointerait sur un layer fantome au rechargement.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    assert.ok(/function _sceneLayer/.test(front), 'pas de resolution layerId -> layer');
    assert.ok(/data-champ="layerId"/.test(front), 'pas de selecteur d\'image par scene');
    assert.ok(!/l\.push\(\{ id: 'scene-1', layer,/.test(front),
      'ajouterScene ne doit plus stocker le layer lui-meme');
    // et les scenes doivent etre persistees, sinon elles disparaissent au reload
    assert.ok(/scenes:\s*state\.scenes\s*\|\|\s*\[\]/.test(front), 'les scenes ne sont pas sauvegardees');
    assert.ok(/state\.scenes\s*=\s*savedState\.scenes/.test(front), 'les scenes ne sont pas rechargees');
    assert.ok(/narration:\s*layer\.narration\s*\|\|\s*null/.test(front),
      'la narration n\'est pas sauvegardee : l\'audio disparait au rechargement');
  });

  test('le multi-scene atteint reellement le backend', () => {
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    const queue = fs.readFileSync(path.join(ROOT, '..', 'server', 'queue-canvas.js'), 'utf8');
    // le payload doit porter les scenes...
    assert.ok(/scenes:\s*projet\.scenes/.test(front), 'le payload n\'envoie pas les scenes');
    assert.ok(/projetCourant\(true/.test(front), 'les images des scenes ne sont pas serialisees');
    // ...et la queue doit router dessus, sinon renderProjectToVideo reste mort
    assert.ok(/renderProjectToVideo/.test(queue),
      'la queue n\'appelle jamais le rendu multi-scene');
    assert.ok(/scenes\.length\s*>\s*1/.test(queue),
      'la queue ne teste pas le nombre de scenes');
  });

  test('une scene tient l\'horloge jusqu\'a la suivante (pauses comprises)', () => {
    // Rendre seulement endMs - startMs escamotait l'ecart entre deux scenes :
    // 2000ms de pause disparaissaient de la video, et comme l'audio est global
    // tout ce qui suivait la premiere pause tombait en avance sur la voix.
    const fs = require('fs');
    const back = fs.readFileSync(path.join(ROOT, '..', 'server', 'canvas-renderer.js'), 'utf8');
    const bloc = back.slice(back.indexOf('async function renderProjectFrames'));
    const fn = bloc.slice(0, bloc.indexOf('\n  return { frames, plan }'));
    assert.ok(/plan\.scenes\[s\.idx \+ 1\]/.test(fn),
      'le rendu ignore la scene suivante : les pauses seront escamotees');
    assert.ok(/finMs\s*-\s*s\.startMs/.test(fn),
      'la duree rendue doit aller jusqu\'au debut de la scene suivante');
    assert.ok(!/const dureeMs = Math\.max\(1, s\.endMs - s\.startMs\)/.test(fn),
      'ancien calcul par scene isolee : les pauses retombent');
  });

  test('les annotations partent BRUTES : pas de double projection', () => {
    // projectAnnotations est applique par le BACKEND. Les pre-projeter cote
    // frontend appliquerait l'offset du layer deux fois.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    const bloc = front.slice(front.indexOf('function projetCourant'));
    const fn = bloc.slice(0, bloc.indexOf('\nfunction renderScenes'));
    assert.ok(!/AnimationLib\.projectAnnotations/.test(fn),
      'projetCourant ne doit pas pre-projeter les regions');
    assert.ok(/annotations:\s*\(layer && layer\.annotations\)/.test(fn),
      'les annotations doivent partir telles quelles');
  });

  test('from/to est le SEUL modele temporel : startMs/durationMs elimines', () => {
    // Deux descriptions concurrentes coexistaient. Le planning ne lit que
    // from/to (AnnotationManager.bornes) : une region decrite en durationMs
    // sortait du plan avec une duree NULLE, et toute la piste — cartes,
    // curseur, declenchement des transitions — retombait sur la mesure au
    // lieu du temps ecrit. On convertit a l'entree et on supprime l'ancien.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    assert.ok(/function _normaliserBornes/.test(front), 'pas de normalisation des bornes');
    // appelee sur les trois entrees du modele : chargement, import, export
    const appels = (front.match(/_normaliserBornes\(/g) || []).length;
    assert.ok(appels >= 4, `_normaliserBornes appelee ${appels}x, attendu >= 4 (def + 3 entrees)`);
    assert.ok(/delete r\.startMs/.test(front) && /delete r\.durationMs/.test(front),
      'les anciens champs doivent etre SUPPRIMES, pas seulement ignores');
    // Plus aucun repli de lecture hors du shim d'import : chaque `reveal.startMs`
    // ou `reveal.durationMs` restant est une seconde source de verite en
    // puissance. Seul importAnnotationJSON a le droit de les lire, pour les
    // convertir immediatement.
    const shim = front.slice(front.indexOf('function importAnnotationJSON'));
    const finShim = shim.indexOf('\nfunction ');
    const corpsShim = shim.slice(0, finShim > 0 ? finShim : shim.length);
    const total = (front.match(/reveal\??\.\s*(startMs|durationMs)/g) || []).length;
    const dansShim = (corpsShim.match(/reveal\??\.\s*(startMs|durationMs)/g) || []).length;
    assert.strictEqual(total - dansShim, 0,
      `${total - dansShim} lecture(s) de reveal.startMs/durationMs hors du shim d'import`);
    assert.ok(dansShim > 0, 'le shim d\'import doit encore lire les anciens champs pour les convertir');
    // l'export ne doit plus jamais ecrire durationMs dans une region
    const bloc = front.slice(front.indexOf('const reveal = {'));
    const rev = bloc.slice(0, bloc.indexOf('};'));
    assert.ok(/from: el\.reveal\.from, to: el\.reveal\.to/.test(rev),
      'l\'export doit ecrire from/to');
    assert.ok(!/durationMs/.test(rev), 'l\'export ne doit plus ecrire durationMs');
  });

  test('le fondu part au temps ECRIT si la scene est annotee, au dernier trait sinon', () => {
    // Deux sources de verite, une par cas, et jamais l'inverse :
    //  - scene annotee : `to` fait foi, le dessin s'y plie, on attend la fin
    //    ecrite (plafonner ici coupait le fondu avant la fin voulue) ;
    //  - scene sans annotation : la carte n'est qu'une ESTIMATION, il n'y a
    //    rien a attendre. Attendre son bord figeait jusqu'a 2 s de canvas sur
    //    un dessin acheve, et l'erreur s'ajoutait de scene en scene : la
    //    transition 2->3 partait plus d'une seconde trop tard.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');

    const corps = (nom) => {
      const bloc = front.slice(front.indexOf(`function ${nom}`));
      return bloc.slice(0, bloc.indexOf('\n}') + 2);
    };

    // l'aiguillage : annotee -> on attend, sinon -> on recale et on part
    assert.ok(/_sceneAnnotee\(i\) \? _resteAvantFinScene\(i\) : \(_recalerFinScene\(i\), 0\)/
      .test(corps('_enchainerScene')), 'l\'aiguillage annotee / non annotee a disparu');

    // plus aucun plafond ni marge soustraite : la fonction ne sert plus qu'aux
    // scenes annotees, ou seul `to` decide
    const reste = corps('_resteAvantFinScene');
    assert.ok(/bloc\.endMs - t/.test(reste), 'le fondu ne vise plus la fin ecrite');
    assert.ok(!/2000|padMs/.test(reste), 'plafond ou marge resurgis dans l\'attente');

    // le curseur ne doit PAS etirer une scene annotee : repousser son endMs
    // retardait le fondu d'autant, marge de 750 ms comprise
    const tick = corps('_majTeteLectureHorloge');
    assert.ok(/_sceneAnnotee\(bloc\.i\)/.test(tick) && /&& !_annotee/.test(tick),
      'l\'apprentissage du curseur etire encore les scenes annotees');

    // et une scene non annotee recale plan ET cartes ensemble, sinon le
    // curseur reste en retard sur des cartes restees a l'ancienne echelle
    const recal = corps('_recalerFinScene');
    assert.ok(/renderTimeline\(\)/.test(recal),
      'le recalage doit redessiner les cartes, pas seulement le plan');
    // ... et replacer la tete DANS LE MEME TICK. Sans ca elle garde une frame
    // la position calculee sur l'ancienne echelle pendant que les cartes ont
    // deja bouge : 2,54 % de la piste, mesure au premier passage.
    assert.ok(/_majTeteLecture\(Math\.min\(t, pl\.totalMs\) \/ pl\.totalMs\)/.test(recal),
      'le recalage doit replacer la tete de lecture sur la nouvelle echelle');

    // AUCUNE marge de projection : elle gonfle totalMs, or le curseur se place
    // a t / totalMs — il RECULE. Mesure sur la derniere scene, seul endroit ou
    // la marge avait d'abord ete conservee : saut arriere de 11,8 % de la
    // piste. Elle ne compensait qu'un defaut deja corrige (le seuil de 40 %
    // qui empechait les durees de converger).
    assert.ok(/const marge = 0;/.test(tick),
      'la marge de projection fait reculer le curseur, elle doit rester nulle');
    assert.ok(!/Math\.max\(750/.test(tick), 'la marge de 750 ms est revenue');

    // et la carte doit decrire le passage qu'on vient de regarder : un seuil
    // de tolerance la laissait figee a 12 % de la verite, indefiniment
    const ench = corps('_enchainerScene');
    assert.ok(/_dureeMs = Math\.round\(performance\.now\(\) - state\._tlDebutScene\)/.test(ench),
      'la mesure doit etre ecrite sans seuil');
    assert.ok(!/ECART_SIGNIFICATIF/.test(ench), 'le seuil anti-jitter est revenu');
  });

  test('les bornes from/to sont reglables et exportees', () => {
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    assert.ok(/id="ann-f-from"/.test(front), 'pas de champ Debut');
    assert.ok(/id="ann-f-to"/.test(front), 'pas de champ Fin');
    assert.ok(/bind\("ann-f-from"/.test(front), 'le champ Debut n\'est pas relie');
    assert.ok(/from: el\.reveal\.from, to: el\.reveal\.to/.test(front),
      'from/to ne partent pas dans annotation.json');
    // les concepts remplaces ne doivent pas reapparaitre
    ['ann-f-pause', 'ann-f-anchor', 'fitToBeat', 'normaliserBeats'].forEach(mort =>
      assert.ok(!front.includes(mort), `${mort} devrait avoir disparu`));
  });

  test('l\'audio global est chargeable et joue en preview', () => {
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    const back  = fs.readFileSync(path.join(ROOT, '..', 'server', 'canvas-renderer.js'), 'utf8');
    assert.ok(/function chargerAudioNarration/.test(front), 'pas de chargement audio');
    assert.ok(/demarrerNarrationPreview/.test(front), 'l\'audio ne joue pas en preview');
    assert.ok(/_resoudreAudioNarration/.test(back), 'le backend ne muxe pas l\'audio');
  });

  test('audioUrl est une data URL, sinon le backend ne peut pas la lire', () => {
    // Une blob: URL n'existe que dans l'onglet ; envoyee au rendu, ffmpeg ne
    // trouve rien et la video sort MUETTE, sans la moindre erreur.
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    const corps = front.slice(front.indexOf('function chargerAudioNarration'));
    const fin = corps.indexOf('\nfunction ');
    const fn = corps.slice(0, fin > 0 ? fin : 2000);
    assert.ok(/readAsDataURL/.test(fn), 'l\'audio doit etre lu en data URL');
    assert.ok(!/audioUrl\s*=\s*URL\.createObjectURL/.test(fn),
      'audioUrl ne doit pas etre une blob: URL');
    // et il doit reellement partir au backend
    assert.ok(/narration:\s*l\.narration/.test(front),
      'la narration n\'est pas dans le payload de rendu');
    assert.ok(/audioUrl\s*\?\s*\{\s*narration/.test(front),
      'l\'export annotation.json doit se declencher sur audioUrl, pas sur les beats');
  });

  test('la duree envoyee au rendu vient de timelineDurationMs', () => {
    // Recalculer max(startMs + durationMs) redonne l'ancienne timeline, trous
    // compris : 11200ms au lieu de 10400ms, soit une video une seconde trop
    // longue qui se fige a la fin. Les trois points d'entree du moteur doivent
    // donc appeler la fonction de lib/.
    // (La barre de lecture de l'editeur d'annotations est une autre horloge :
    //  elle suit les startMs et les badges de detection, et n'est pas visee.)
    const fs = require('fs');
    const cibles = {
      'app/index.html': /duration:[\s\S]{0,400}?timelineDurationMs/,
      'server/test-render-annotations.js': /timelineDurationMs\(/,
    };
    for (const [f, re] of Object.entries(cibles)) {
      const src = fs.readFileSync(path.join(ROOT, '..', f), 'utf8');
      assert.ok(re.test(src), `${f} n'utilise pas timelineDurationMs pour la duree du rendu`);
    }
  });

  test('frontend et backend appellent la MEME fonction', () => {
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    const back  = fs.readFileSync(path.join(ROOT, '..', 'server', 'canvas-renderer.js'), 'utf8');
    assert.ok(front.includes('projectAnnotations'), 'frontend ne projette pas via lib/');
    assert.ok(back.includes('projectAnnotations'),  'backend ne projette pas via lib/');
  });
});

// ─────────────────────────────────────────────────────────────
suite('Curseurs Reveal speed / Hand speed en mode annotation', () => {
  const frames = (o) => run('scanner', mkState(o)).frames;
  const DEF = 40;   // valeur par defaut du curseur = 1x

  test(`speed=${DEF} (defaut) : durationMs honore exactement -> parite Python`, () =>
    assert.ok(Math.abs(frames({ speed: DEF }) - BUDGET) <= 3,
      `${frames({ speed: DEF })}f au lieu de ${BUDGET}f`));

  test('speed x2 : timeline deux fois plus courte', () => {
    const f = frames({ speed: DEF * 2 });
    assert.ok(Math.abs(f - BUDGET / 2) <= 3, `${f}f au lieu de ~${Math.round(BUDGET/2)}f`);
  });

  test('speed /2 : timeline deux fois plus longue', () => {
    const f = frames({ speed: DEF / 2 });
    assert.ok(Math.abs(f - BUDGET * 2) <= 4, `${f}f au lieu de ~${BUDGET*2}f`);
  });

  test('le multiplicateur est monotone', () => {
    const lent = frames({ speed: 10 }), moyen = frames({ speed: 40 }), vite = frames({ speed: 100 });
    assert.ok(lent > moyen && moyen > vite, `${lent} > ${moyen} > ${vite} attendu`);
  });

  test('handSpeed ne change PAS la duree (c\'est durationMs qui la fixe)', () => {
    assert.strictEqual(frames({ handSpeed: 1 }), frames({ handSpeed: 20 }));
  });

  // La main doit etre EXACTEMENT sur la pointe du trace : c'est le principe
  // meme d'une animation whiteboard. Un lissage de la position desynchronisait
  // la main de l'encre (jusqu'a 455px d'ecart a handSpeed=1).
  const ecartMainPointe = (style, handSpeed, annotations) => {
    const state = mkState({ handSpeed, annotations });
    const cibles = [], dessines = [];
    const a = AnimationFactory.create(style, { state, ctx: mkCtx(), hctx: mkCtx(),
      offscreen: { getContext: () => mkCtx(), width: W, height: H },
      callbacks: { fillBg(){}, drawHand(h, x, y) { dessines.push([x, y]); },
                   setProgress(){}, finishAnim(){}, resScale: () => 1, resPointScale: () => 1 } });
    const wrap = a.drawHand;
    a.drawHand = (h, x, y, d, hd) => { cibles.push([x, y]); return wrap(h, x, y, d, hd); };
    a.setup();
    for (let i = 0; i < 40; i++) a.tick(40, FRAME);
    return Math.max(0, ...cibles.map((c, i) =>
      dessines[i] ? Math.hypot(c[0] - dessines[i][0], c[1] - dessines[i][1]) : 0));
  };

  for (const hs of [1, 6, 20]) {
    test(`handSpeed=${hs} : la main reste sur la pointe du trace`, () => {
      const e = ecartMainPointe('scanner', hs, REGIONS());
      assert.strictEqual(Math.round(e), 0, `main decalee de ${Math.round(e)}px`);
    });
  }
  test('legacy : la main reste sur la pointe du trace', () =>
    assert.strictEqual(Math.round(ecartMainPointe('scanner', 6, [])), 0));

  test('legacy : handSpeed et speed pilotent toujours la duree', () => {
    const f = (o) => run('chunkjump', mkState({ annotations: [], ...o })).frames;
    assert.notStrictEqual(f({ handSpeed: 1 }), f({ handSpeed: 20 }));
  });
});

// ─────────────────────────────────────────────────────────────
suite('Geometrie de la main (parite frontend / backend)', () => {
  const { handDrawRect } = require(ROOT);
  const CFG = { width: 648, height: 1152, tipX: 325, tipY: 1 };   // custom1 @1080

  const pointe = (r) => [Math.round(r.x + CFG.tipX * r.scale), Math.round(r.y + CFG.tipY * r.scale)];

  test('la pointe reste sur le trait quelle que soit la taille du canvas', () => {
    for (const [w, h] of [[1920,1080], [1536,864], [1280,720], [2560,1440]]) {
      const r = handDrawRect(CFG, '1080', 900, 600, w, h);
      assert.deepStrictEqual(pointe(r), [900, 600], `canvas ${w}x${h}`);
    }
  });

  test('la main ne depasse pas 85% de la hauteur du canvas', () => {
    for (const [w, h] of [[1920,1080], [1536,864], [1280,720], [2560,1440]]) {
      const r = handDrawRect(CFG, '1080', 900, 600, w, h);
      assert.ok(r.height <= h * 0.85 + 1,
        `canvas ${w}x${h} : main ${Math.round(r.height)}px pour ${Math.round(h*0.85)}px max`);
    }
  });

  test('mise a l\'echelle selon le palier (720/1080/1440)', () => {
    // meme canvas, paliers differents -> echelles differentes
    const a = handDrawRect({ ...CFG, height: 100 }, '720',  0, 0, 1280, 720);
    const b = handDrawRect({ ...CFG, height: 100 }, '1440', 0, 0, 1280, 720);
    assert.ok(a.scale > b.scale, 'un asset 1440 doit etre reduit davantage sur un petit canvas');
  });

  test('frontend et backend appellent la MEME fonction', () => {
    const fs = require('fs');
    const front = fs.readFileSync(path.join(ROOT, '..', 'app', 'index.html'), 'utf8');
    const back  = fs.readFileSync(path.join(ROOT, '..', 'server', 'canvas-renderer.js'), 'utf8');
    assert.ok(front.includes('handDrawRect'), 'frontend ne passe pas par handDrawRect');
    assert.ok(back.includes('handDrawRect'),  'backend ne passe pas par handDrawRect');
  });
});

// ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(58)}`);
if (echecs.length) {
  console.log(`${ok} ok, ${echecs.length} ECHEC(S)\n`);
  echecs.forEach(([n, m]) => console.log(`  ✗ ${n}\n      ${m}`));
  process.exit(1);
}
console.log(`${ok}/${ok} tests OK`);
