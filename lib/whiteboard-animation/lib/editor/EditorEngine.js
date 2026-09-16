/**
 * EditorEngine — le moteur de dessin, sorti de app/index.html.
 *
 * POURQUOI UNE CLOSURE ET PAS UNE CLASSE
 * Les 23 fonctions du noyau sont reprises VERBATIM de app/index.html : elles
 * lisent `state`, `ctx`, `hctx`, `offscreen` comme des variables libres. Les
 * transformer en `this.state` / `this.ctx` aurait voulu dire toucher a des
 * centaines de lignes de code de dessin qui marche — pour rien. Ici les memes
 * variables vivent dans la closure : le code est inchange, et chaque appel a
 * createEditorEngine() a pourtant SES canvases et SON etat.
 *
 * C'est ce qui remplace app/animations-unified.js, ou `state` et `ctx` etaient
 * des variables de module posees par _setGlobals() : un seul moteur possible
 * par page, incompatible avec des composants React montes/demontes.
 *
 * CE QUE LE MOTEUR NE FAIT PLUS
 * Il n'a plus le droit de lire le DOM. Deux categories y passaient :
 *  - des REGLAGES lus dans des cases a cocher (image-reveal, outline-visible,
 *    font-select...) : ce sont maintenant des `options` ;
 *  - du RETOUR VISUEL ecrit dans des badges et des barres (progress-fill,
 *    done-badge, play-pause-btn...) : ce sont maintenant des `hooks`.
 * L'hote decide ou ca s'affiche. Le moteur dit seulement ce qui se passe.
 *
 * @param canvases {main, hand, sel} — les trois calques de rendu
 * @param state    etat initial (canvasW, canvasH, layers, animStyle, speed...)
 * @param options  reglages qui etaient dans le DOM
 * @param hooks    ce que l'hote veut savoir
 */
'use strict';

const { AnimationFactory, projectAnnotations, buildProjectSchedule, CUSTOM_HANDS,
        handDrawRect } = require('../index');


/**
 * L'etat de tick qui appartient a UN calque, et non a la scene.
 *
 * animations-unified.js exposait `_SLOT_KEYS: []` — une liste VIDE. C'est ce
 * qui rendait le rendu parallele inoperant : tous les calques d'un groupe se
 * partageaient le meme etat de trace, donc un seul avancait reellement. La
 * liste est reprise du bloc de remise a zero de _runGroupAt(), qui enumere
 * exactement ces champs.
 *
 * N'y figurent PAS : `done`, `playing`, `_animProgress`, `bgCanvas` — ils
 * decrivent la scene, pas un calque.
 */
const _SLOT_KEYS = [
  'revealCanvas', 'edgeCanvas',
  'ofOutlineCanvas', 'ofColorCanvas', 'ofPhase', 'ofPerimIdx', 'ofFillIdx',
  'ofLastDrawn', 'ofColorGroups', 'ofColorIdx', 'ofWaypointIdx', 'ofRevealY',
  'ofOutlineThickness',
  'ifOutlineCanvas', 'ifColorCanvas', 'ifInkCanvas', 'ifPhase', 'ifPerimIdx',
  'ifLastDrawn', 'ifInkIdx', 'ifInkLastDrawn', 'ifInkWaypoints', 'ifInternalIdx',
  'ifInternalLast', 'ifColorGroups', 'ifColorIdx', 'ifWaypointIdx', 'ifRevealY',
  'ifOutlineColor', 'ifOutlineThickness',
  'scribblePhase', 'contourPhase', 'contourEdgeIdx', 'contourFillIdx',
  'noFlashFinish',
  'stPhase', 'stOutlineCanvas', 'stOutlinePts', 'stOutlineIdx',
  'stOutlineLastDrawn', 'stFillPts',
  'curX', 'curY', 'scanDir', 'strokeList', 'strokeIdx',
  'contentBounds', '_fullContentBounds', '_regionRect',
  '_lastAnnotationIdx', '_annotationChanged',
  'animStyle', 'hand', 'zigzag', 'textAnimDir', 'textDrawStyle',
  'outlineDetect', 'outlineAlgorithm', 'outlineStrokeStyle',
  'speed', 'handSpeed', 'tileSlider', 'specChunks',
  'annotations', 'narration', '_annIdx', '_annAnimSetup', '_lastFrameMs',
  // styles qui gardent leurs propres traces
  'contourEdgePts', 'contourEdgeColors', 'contourFillPts',
  'outlineChunksPhase', 'outlineChunksEdgePts', 'outlineChunksEdgeColors',
  'outlineChunksEdgeIdx', 'outlineChunksChunkPts', 'outlineChunksChunkIdx',
  'ofPerimPts', 'ofOutlineColor', 'ifPerimPts',
  'stOutlineColor', 'stOutlineThickness',
  'gestureSketchCanvas', 'gesturePass1End', 'gestureRevealY',
];

/**
 * Ce qui appartient a la SCENE et doit rester partage entre les calques.
 * Sert au test qui verifie qu'aucune clef d'etat lue par lib/styles n'echappe
 * a l'une des deux listes : une clef oubliee serait partagee sans qu'on le
 * sache, et deux calques d'un meme groupe se marcheraient dessus — le defaut
 * exact qui rendait le rendu parallele inoperant.
 */
const _CLES_SCENE = [
  'canvasW', 'canvasH', 'layers', 'bgCanvas', '_annBgCanvas', 'done', 'playing',
  'progress', '_animProgress', 'color', 'canvasBg', 'sceneIndex', 'scenes',
  '_lectureProjet', 'departMs', 'activeLayerIndex', '_activeSlots', '_currentSlot',
  '_slotMode', '_revealFinalCanvas', '_dissolveMap', 'animFrame', '_animQueue',
  '_animGroups', '_queuePos', '_groupPos', 'revealDuration', 'colorStyle',
];

/** Rayon des poignees de selection. Etait lu comme un global du index.html
 *  d'origine : sous 'use strict' c'etait un ReferenceError a chaque fin de
 *  scene, drawSelectionHandles() etant appele par _finDeGroupe(). */
const HANDLE_R = 6;

const OPTIONS_DEFAUT = {
  imageReveal: true,       // devoilement progressif de l'image sous le trace
  outlineVisible: true,
  outlineOpacity: 100,
  text: '', font: 'Caveat', fontSize: 52,   // scene sans image : texte de repli
  // Le fondu final vers l'image nette. 'instant' le supprime. Ces deux reglages
  // etaient lus comme des globals (_revealStyle / _revealDuration), absents du
  // module : _runGroupAt() jetait des la premiere scene en illustfill.
  revealStyle: 'fade',
  revealDuration: 600,
  // Les degrades de fond, fournis par l'hote sous forme { cle: (ctx) => void }.
  bgGradients: {},
  // Racine des sprites de main. CUSTOM_HANDS porte des chemins relatifs.
  handBasePath: '/',
};

/** Aucun hook n'est obligatoire : un moteur sans hote dessine quand meme. */
const HOOKS_DEFAUT = {
  onProgress() {},          // (pct, labelScene)
  onDone() {},              // (fini)
  onPlayable() {},          // (activable)
  onPlayState() {},         // (enLecture)
  onStyleLabel() {},        // (texte)
  onTicker() {},            // demarrer le curseur de la piste
  onPlayhead() {},          // (ratio) -1 = cacher
  onSceneDone: () => false, // true = l'hote enchaine une autre scene
  onTransition() {},        // (indexScene, ms) une transition demarre
  ensureLayerAnnotations() {},
  projet: () => null,       // le projet multi-scene, pour le decalage de depart
  outlineOverlay: () => null,
  cartesTimeline: () => [],
  narration: { start() {}, stop() {}, sync() {}, enCours: () => false },
};

function createEditorEngine({ canvases, state: etatInitial = {}, options = {}, hooks = {} } = {}) {
  if (!canvases || !canvases.main) throw new Error('createEditorEngine: canvases.main est requis');

  const O = { ...OPTIONS_DEFAUT, ...options };
  const H = { ...HOOKS_DEFAUT, ...hooks, narration: { ...HOOKS_DEFAUT.narration, ...(hooks.narration || {}) } };

  const state = {
    canvasW: 1280, canvasH: 720, layers: [], animStyle: 'scanner',
    speed: 40, handSpeed: 6, tileSlider: 30, hand: 'custom1',
    color: '#111111', canvasBg: { type: 'solid', val: 'white' },
    playing: false, done: false, progress: 0, contentBounds: null,
    ...etatInitial,
  };

  // `ctx` n'est pas constant : _runGroupAt le fait pointer sur le canvas d'un
  // slot pendant le rendu parallele, d'ou la reference permanente _mainCtx.
  const _mainCtx = canvases.main.getContext('2d');
  let ctx = _mainCtx;
  const hctx = canvases.hand
    ? canvases.hand.getContext('2d')
    : document.createElement('canvas').getContext('2d');
  const sctx = canvases.sel
    ? canvases.sel.getContext('2d')
    : document.createElement('canvas').getContext('2d');

  let offscreen = null;
  let anim = null;   // l'instance lib/ courante

  /** Charge dans l'etat partage le trace en cours d'un slot. */
  function _slotIn(slot) {
    _SLOT_KEYS.forEach((k) => { state[k] = slot._state[k]; });
  }

  /** Range le trace du slot, pour que le suivant ne marche pas dessus. */
  function _slotOut(slot) {
    _SLOT_KEYS.forEach((k) => { slot._state[k] = state[k]; });
  }

  /**
   * Une frame de dessin.
   *
   * Les calques d'un meme groupe avancent ENSEMBLE : chacun a son canvas, son
   * etat de trace et sa propre instance d'animation, et on les fait avancer
   * tour a tour d'un pas avant de recomposer l'image. Auparavant `setupStyle()`
   * ecrasait l'unique instance a chaque calque du groupe : seul le dernier
   * s'animait, les autres apparaissaient d'un coup au composite de fin.
   */
  function _tick(dt) {
    const slots = state._activeSlots || [];
    if (!slots.length) { if (anim) anim.tick(state.speed || 40, dt || 16.67); return; }

    const _ctxAvant = ctx, _offAvant = offscreen, _animAvant = anim;
    slots.filter((s) => !s.done).forEach((slot) => {
      _slotIn(slot);
      ctx = slot.ctx; offscreen = slot.offscreen; anim = slot.anim;
      state._currentSlot = slot; state._slotMode = true;
      if (anim) anim.tick(state.speed || 40, dt || 16.67);
      _slotOut(slot);
    });
    state._currentSlot = null; state._slotMode = false;
    ctx = _ctxAvant; offscreen = _offAvant; anim = _animAvant;

    _composerSlots();
    if (slots.every((s) => s.done)) _finDeGroupe(state.animStyle);
  }

  /** Le fond, puis le canvas de chaque calque du groupe, par-dessus. */
  function _composerSlots() {
    fillBg(_mainCtx);
    (state._activeSlots || []).forEach((slot) => {
      if (slot.canvas) _mainCtx.drawImage(slot.canvas, 0, 0);
    });
  }

  /** Le libelle que setProgress affichait dans #progress-scene-label. */
  function _labelScene() {
    const nb = (state.scenes || []).length;
    return (state._lectureProjet && nb > 1) ? `Scene ${(state.sceneIndex ?? 0) + 1}/${nb}` : '';
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Noyau repris de app/index.html. Ne pas reecrire : c'est la reference.
  // ═══════════════════════════════════════════════════════════════════════

  function resScale() {
    return Math.sqrt((state.canvasW * state.canvasH) / (1280 * 720));
  }

  // Sub-linear scale used for perimeter point density.
  // Linear scaling (resScale) at 1440p gives 2× more outline points which traces
  // every pixel-level silhouette bump — looks crunchy. Raising to 0.6 keeps the
  // outline smooth at all resolutions while still adding enough points for clarity.
  //   720p → 1.0 · 1080p → 1.31 · 1440p → 1.57

  function resPointScale() {
    return Math.pow(resScale(), 0.6);
  }

  // Stroke softening blur — the tiny amount of shadowBlur that restores the
  // hand-drawn softness that canvas anti-aliasing provides naturally at 720p
  // but loses at higher resolutions where lines become pixel-crisp.
  //   720p → 0 · 1080p → 0.75 · 1440p → 1.5

  function getCurrentResolution() {
    const maxDim = Math.max(state.canvasW, state.canvasH);
    const isPortrait = state.canvasH > state.canvasW;
  
    // Determine base resolution
    let baseRes;
    if (maxDim <= 1280) baseRes = '720';
    else if (maxDim <= 1920) baseRes = '1080';
    else baseRes = '1440';
  
    // Return vertical version for portrait orientation (9:16)
    if (isPortrait) {
      return `${baseRes}v`;
    }
  
    return baseRes;
  }

  function getLayerById(id) { return state.layers.find(l=>l.id===id); }

  function getSelectedLayer() { return getLayerById(state.selectedLayerId); }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION GENERATION & ORCHESTRATION
  // ═══════════════════════════════════════════════════════════════════════════

  function getCurrentLayer() {
    if (state._currentSlot && state._currentSlot.layer) {
      return state._currentSlot.layer;
    }
    if (state._animQueue && state._animQueue[state._queuePos]) {
      return state._animQueue[state._queuePos];
    }
    return getSelectedLayer() || (state.layers && state.layers[state.activeLayerIndex]) || null;
  }

  // ─── PRE-RENDER ───

  function detectContentBounds(oc) {
    const W=oc.width, H=oc.height;
    const d=oc.getContext('2d').getImageData(0,0,W,H).data;
    let minX=W,minY=H,maxX=0,maxY=0;
    for (let y=0;y<H;y++) for (let x=0;x<W;x++) {
      const i=(y*W+x)*4;
      const a=d[i+3];
      const notWhite = d[i]<240 || d[i+1]<240 || d[i+2]<240;
      const hasTrans  = a < 250;
      if (a>20 && (notWhite || hasTrans)) {
        if(x<minX)minX=x; if(x>maxX)maxX=x;
        if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
    }
    if (maxX<minX) return {x:0,y:0,w:W,h:H};
    const pad=28;
    const bx=Math.max(0,minX-pad), by=Math.max(0,minY-pad);
    return { x:bx, y:by, w:Math.min(W,maxX+pad)-bx, h:Math.min(H,maxY+pad)-by };
  }

  function fillBg(c) {
    if (state._slotMode) { c.clearRect(0,0,state.canvasW,state.canvasH); return; }
    const bg = state.canvasBg;
    if (bg.type === 'solid') {
      if (bg.val === 'transparent') { c.clearRect(0,0,state.canvasW,state.canvasH); }
      else { c.fillStyle = (bg.val === 'white') ? '#ffffff' : bg.val; c.fillRect(0,0,state.canvasW,state.canvasH); }
    } else if (bg.type === 'gradient' && O.bgGradients[bg.key]) {
      c.save(); O.bgGradients[bg.key](c); c.restore();
    } else if (bg.type === 'custom') {
      c.fillStyle = bg.val; c.fillRect(0,0,state.canvasW,state.canvasH);
    } else {
      c.fillStyle='#fff'; c.fillRect(0,0,state.canvasW,state.canvasH);
    }
    if (state.bgCanvas) {
      c.drawImage(state.bgCanvas, 0, 0);
    }
    if (state._annBgCanvas) {
      c.drawImage(state._annBgCanvas, 0, 0);
    }
  }

  function _buildGroupBgCanvas(gpos) {
    const bg = document.createElement('canvas');
    bg.width = state.canvasW; bg.height = state.canvasH;
    const bc = bg.getContext('2d');
    // Draw the scene background (without any bgCanvas reference — avoids self-draw)
    const _tmpBg = state.bgCanvas; state.bgCanvas = null;
    fillBg(bc);
    state.bgCanvas = _tmpBg;
    return bg;
  }

  function getAnimOrder() {
    const visible    = state.layers.filter(l => l.visible !== false);
    const ordered    = visible.filter(l=>l.animOrder!==null).sort((a,b)=>a.animOrder-b.animOrder);
    const unordered  = visible.filter(l=>l.animOrder===null);
    return [...ordered, ...unordered];
  }

  /**
   * Fin de l'animation d'une scene. En lecture projet, enchaine sur la scene
   * suivante et retourne true : l'appelant ne doit alors PAS afficher "Done".
   * Appele depuis le _snap() d'animations.js, qui est le vrai point de sortie.
   */

  function drawHand(c,tipX,tipY,dir,style) {
    if (style === 'ghost') return;
    c.save();
    // Always draw as right hand — no flipping based on movement direction.
    const hx=tipX-35, hy=tipY-30;
  
    // Check if it's a custom hand; fall back to custom1 if style is unknown
    if (CUSTOM_HANDS[style]) {
      drawCustomHand(c, hx, hy, tipX, tipY, style);
    } else {
      drawCustomHand(c, hx, hy, tipX, tipY, 'custom1');
    }
    c.restore();
  }

  // drawMarkerHand: simple fallback when images aren't loaded

  function drawMarkerHand(c, hx, hy, tipX, tipY) {
    c.save();
    c.fillStyle = 'rgba(0, 0, 0, 0.3)';
    c.beginPath();
    c.arc(tipX, tipY, 6, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // ═══════════════════════════════════════════
  // CUSTOM IMAGE-BASED HANDS CONFIGURATION
  // ═══════════════════════════════════════════
  // EASY TO EDIT: Just change the image paths and tip coordinates below
  // Each hand has 6 versions:
  //   - 720, 1080, 1440 for landscape/square (16:9, 1:1)
  //   - 720v, 1080v, 1440v for portrait (9:16) with rotated hand

  // CUSTOM_HANDS vient de lib/hands.js, importe en haut du module. Dans
  // index.html c'etait un getter pose sur `window`, pour attendre que le
  // bundle UMD soit charge — un import direct rend l'attente sans objet.

  // Storage for loaded hand images
  const customHandImages = {};

  /**
   * Charge les sprites de main.
   *
   * Le commentaire d'origine annoncait un chargeur qui n'a jamais ete porte :
   * customHandImages restait VIDE, donc drawCustomHand() tombait a chaque frame
   * dans la branche "image missing" et peignait un cartouche d'erreur rouge sur
   * le canvas. Les chemins de CUSTOM_HANDS sont relatifs ('images/...'), d'ou
   * O.handBasePath.
   *
   * Hors navigateur (tests headless) il n'y a pas d'Image : on ne charge rien et
   * drawCustomHand retombe sur le marqueur, ce qui est le comportement voulu.
   */
  function chargerMains() {
    if (typeof Image === 'undefined') return;
    const base = O.handBasePath || '/';
    Object.keys(CUSTOM_HANDS).forEach((style) => {
      customHandImages[style] = customHandImages[style] || {};
      Object.entries(CUSTOM_HANDS[style].images).forEach(([res, cfg]) => {
        const img = new Image();
        img.src = base.replace(/\/$/, '') + '/' + String(cfg.path).replace(/^\//, '');
        img.onload = () => { customHandImages[style][res] = img; };
      });
    });
  }
  chargerMains();


  function drawCustomHand(c, hx, hy, tipX, tipY, style) {
    const handConfig = CUSTOM_HANDS[style];
    if (!handConfig) {
      drawMarkerHand(c, hx, hy, tipX, tipY);
      return;
    }
  
    const resolution = getCurrentResolution();
    const imageConfig = handConfig.images[resolution];
    const img = customHandImages[style] && customHandImages[style][resolution];
  
    // Sprite pas encore arrive : les images se chargent en asynchrone, l'etat
    // normal des premieres frames. On trace le marqueur, sans le cartouche
    // d'erreur rouge d'origine qui se serait affiche a chaque demarrage.
    if (!img || !imageConfig) {
      drawMarkerHand(c, hx, hy, tipX, tipY);
      return;
    }
  
    c.save();
    // handDrawRect vient de lib/ : meme geometrie que le rendu serveur.
    const r = handDrawRect(imageConfig, resolution, tipX, tipY,
                           state.canvasW, state.canvasH);
    c.drawImage(img, r.x, r.y, r.width, r.height);
    c.restore();
  }

  // ─── RECORDING ───

  // ═══════════════════════════════════════════
  // BANNER-BASED EXPORT SYSTEM
  // ═══════════════════════════════════════════

  // Initialize export state
  if (!state.exportQuality) state.exportQuality = 'medium';
  if (!state.exportPNG) state.exportPNG = false;

  function drawSelectionHandles() {
    sctx.clearRect(0,0,state.canvasW,state.canvasH);
    const layer = getSelectedLayer();
    if (!layer || state.playing || state._lectureProjet) return;
    const {x,y,w,h} = layer;
    sctx.save();
    // Selection rect
    sctx.strokeStyle='#6c63ff';
    sctx.lineWidth=2;
    sctx.setLineDash([5,3]);
    sctx.strokeRect(x,y,w,h);
    sctx.setLineDash([]);
    // Corner handles
    const corners = [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
    corners.forEach(([cx2,cy2])=>{
      sctx.fillStyle='#6c63ff';
      sctx.beginPath(); sctx.arc(cx2,cy2,HANDLE_R,0,Math.PI*2); sctx.fill();
      sctx.strokeStyle='#fff'; sctx.lineWidth=1.5; sctx.stroke();
    });
    // Edge midpoint handles
    const mids = [[x+w/2,y],[x+w,y+h/2],[x+w/2,y+h],[x,y+h/2]];
    mids.forEach(([cx2,cy2])=>{
      sctx.fillStyle='#fff';
      sctx.beginPath(); sctx.arc(cx2,cy2,4,0,Math.PI*2); sctx.fill();
      sctx.strokeStyle='#6c63ff'; sctx.lineWidth=1.5; sctx.stroke();
    });
    sctx.restore();
  }

  // ── Canvas pointer interaction: move + resize ──
  let _interact = null; // {type:'move'|'resize', corner, startX, startY, origLayer}
  let _scale = 1; // canvas CSS scale

  function redrawWithBg() {
    fillBg(ctx);
    state.layers.forEach(layer => {
      if (layer.visible === false) return;
      ctx.save();
      ctx.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
      ctx.drawImage(layer.img, layer.x, layer.y, layer.w, layer.h);
      ctx.restore();
    });
    drawSelectionHandles();
  }

  function preRender(existingBgCanvas, targetLayer) {
    const layer = targetLayer || getCurrentLayer();

    // bgCanvas: background + all already-finished layers
    // If passed in from finishAnim, reuse it (already up to date) — otherwise build fresh
    if (existingBgCanvas) {
      state.bgCanvas = existingBgCanvas;
    } else {
      state.bgCanvas = document.createElement('canvas');
      state.bgCanvas.width  = state.canvasW;
      state.bgCanvas.height = state.canvasH;
      const bc = state.bgCanvas.getContext('2d');
      // BUG FIX: temporarily null state.bgCanvas so fillBg doesn't try to draw
      // the (empty) bgCanvas into itself, and to avoid any stale reference.
      const _tmpBg = state.bgCanvas;
      state.bgCanvas = null;
      fillBg(bc);
      state.bgCanvas = _tmpBg;
      // BUG FIX: was using state.activeLayerIndex (raw array index) which included
      // layers that haven't been animated yet when the queue order differs from array
      // order. Now we only bake layers that have ALREADY completed in the queue.
      const alreadyDone = (state._animQueue || []).slice(0, state._queuePos || 0);
      alreadyDone.forEach(l => {
        if (!l) return;
        bc.save(); bc.globalAlpha = (l.opacity !== undefined ? l.opacity : 1);
        bc.drawImage(l.img, l.x, l.y, l.w, l.h);
        bc.restore();
      });
    }

    // offscreen: current layer ONLY (what the animation reveals)
    offscreen = document.createElement('canvas');
    offscreen.width  = state.canvasW;
    offscreen.height = state.canvasH;
    const oc = offscreen.getContext('2d', { willReadFrequently: true });
    if (layer) {
      oc.save(); oc.globalAlpha = (layer.opacity !== undefined ? layer.opacity : 1);
      oc.drawImage(layer.img, layer.x, layer.y, layer.w, layer.h);
      oc.restore();
    } else {
      const text  = (O.text || 'Hello, World!');
      const font  = O.font;
      const size  = (O.fontSize || 52);
      oc.fillStyle = state.color; oc.font = `${size}px '${font}'`;
      oc.textAlign = 'center'; oc.textBaseline = 'middle';
      const lines = text.split('\n'), lineH = size * 1.3;
      const startY = (state.canvasH - lines.length * lineH) / 2 + lineH / 2;
      lines.forEach((ln, i2) => oc.fillText(ln, state.canvasW / 2, startY + i2 * lineH));
    }

    state.contentBounds = detectContentBounds(offscreen);

  }

  function setupStyle() {
    const layer = getCurrentLayer();

    if (layer) H.ensureLayerAnnotations(layer);

    // Annotations live on the layer, but the engine receives the global state.
    // Hand them over so lib/ styles can run annotation-aware instead of legacy.
    // region.{x,y,width,height} are in NATURAL IMAGE pixels; the engine works in
    // canvas pixels, so project them here with the same mapping the overlay uses.
    // projectAnnotations vient de lib/ : meme fonction que le rendu serveur,
    // pour que preview et video placent les regions au meme endroit.
    state._lastFrameMs = 0;   // repart d'une horloge propre a chaque generation
    // En lecture projet l'audio traverse les scenes : le couper ici le faisait
    // repartir de zero a chaque transition.
    if (!state._lectureProjet) H.narration.stop();

    state.annotations = projectAnnotations(layer);
    // La narration ne porte plus que l'audio global : le planning vient des
    // bornes from/to des annotations, pas d'elle.
    state.narration = (layer && layer.narration) || null;

    // Une instance lib/ par moteur, au lieu du singleton d'animations-unified.js
    anim = AnimationFactory.create(state.animStyle || 'scanner', {
      state, ctx, hctx, offscreen,
      callbacks: { fillBg, drawHand, setProgress, finishAnim, resScale, resPointScale },
    });
    if (anim) anim.setup();
  }

  function setProgress(ratio) {
    state._animProgress = Math.min(ratio, 1);
    // En lecture projet la barre couvre TOUTES les scenes : sinon elle repartait
    // de 0 a chaque scene et la video paraissait recommencer.
    // ponytail: chaque scene pese pareil. Les durees reelles ne sont connues
    // qu'apres coup en preview ; ponderer par buildProjectSchedule si l'ecart
    // devient genant.
    let global = state._animProgress;
    const nb = (state.scenes || []).length;
    if (state._lectureProjet && nb > 1) {
      global = ((state.sceneIndex ?? 0) + state._animProgress) / nb;
    }
    const pct=Math.round(global*100);
    H.onProgress(pct, _labelScene());
  
    const lbl=null;
    if (lbl) {
      lbl.textContent = (state._lectureProjet && nb > 1) ? `Scène ${(state.sceneIndex ?? 0)+1}/${nb}` : '';
    }
    // Le curseur de la timeline n'est PAS pilote ici : la progression du moteur
    // se fige entre deux annotations, et le curseur se figeait avec elle. Il
    // suit une horloge continue, cf. _majTeteLectureHorloge().
    if (state._lectureProjet) {
      const cartes = H.cartesTimeline();
      cartes.forEach((c, i) => c.classList.toggle('active', i === (state.sceneIndex ?? 0)));
    }
  }

  // ══════════════════════════════════════════════════════════
  // NARRATION EN PREVIEW — l'audio suit l'horloge d'animation, pas l'inverse.
  // Sans ca on ne peut verifier la synchro qu'en exportant une video.
  // ══════════════════════════════════════════════════════════

  let _narrAudioPreview = null;

  function calculerDepartMsScene(sceneIdx) {
    if (!state.scenes || state.scenes.length <= 1) return 0;
    try {
      const proj = H.projet();
      if (!proj) return 0;
      const sched = buildProjectSchedule(proj);
      const plan = sched.scenes[sceneIdx ?? 0];
      return plan ? plan.startMs : 0;
    } catch (e) {
      return 0;
    }
  }

  /** Demarre la narration en meme temps que l'animation. */

  function animate() {
    if (!state.playing) {
      hctx.clearRect(0, 0, state.canvasW, state.canvasH);  // Clean hand canvas when stopped
      return;
    }
    // Delta reel entre deux frames, calcule avant TOUTE branche de tick.
    const _now = performance.now();
    const _dt = state._lastFrameMs ? Math.min(100, _now - state._lastFrameMs) : 16.67;
    state._lastFrameMs = _now;

    // Parallel slot mode — tick all active slots then composite
    if (state._activeSlots && state._activeSlots.some(s => !s.done)) {
      _tick(_dt);
      if (state.playing) state.animFrame = requestAnimationFrame(animate);
      return;
    }

    _tick(_dt);

    const _anim = anim;
    if (_anim && _anim.annotationManager) H.narration.sync(_anim.annotationManager.elapsedMs);

    if (state.playing) state.animFrame=requestAnimationFrame(animate);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYBACK CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  function resetAnim() {
    cancelAnimationFrame(state.animFrame);
    H.narration.stop();
    // Clean up any active parallel slots
    state._activeSlots  = [];
    state._currentSlot  = null;
    state._slotMode     = false;
    state._annBgCanvas  = null;
    state._annIdx       = 0;
    state._annAnimSetup = false;
    ctx = _mainCtx;
    state.playing=false; state.done=false;
    state.revealCanvas=null;
    state.edgeCanvas=null;
    state.ofOutlineCanvas=null; state.ofColorCanvas=null;
    state.ofPhase=1; state.ofPerimIdx=0; state.ofFillIdx=0; state.ofLastDrawn=0;
    state.ofColorGroups=null; state.ofColorIdx=0; state.ofWaypointIdx=0; state.ofRevealY=0; state.ofOutlineThickness=null;
    state.ifOutlineCanvas=null; state.ifColorCanvas=null; state.ifInkCanvas=null;
    state.ifPhase=1; state.ifPerimIdx=0; state.ifLastDrawn=0;
    state.ifInkIdx=0; state.ifInkLastDrawn=0; state.ifInkWaypoints=null;
    state.ifInternalIdx=0; state.ifInternalLast=0;
    state.ifColorGroups=null; state.ifColorIdx=0; state.ifWaypointIdx=0; state.ifRevealY=0;
    // spec-text outline/fill state
    state.stPhase=1; state.stOutlineCanvas=null; state.stOutlinePts=null;
    state.stOutlineIdx=0; state.stOutlineLastDrawn=0; state.stFillPts=null;
    // Note: bgCanvas is NOT cleared here — it is managed by preRender/finishAnim
    state.scribblePhase=0;
    state.contourPhase=1;
    state.noFlashFinish=false;
    H.onPlayState(state.playing);
    // Only wipe the canvas if we're not mid-sequence (bgCanvas present means layers already drawn)
    if (!state.bgCanvas) fillBg(ctx);
    hctx.clearRect(0,0,state.canvasW,state.canvasH);
    sctx.clearRect(0,0,state.canvasW,state.canvasH);
    setProgress(0);
    const ov = H.outlineOverlay();
    if (ov) { ov.style.display='none'; ov.style.opacity=1; }
  }

  function startAnim()  {
    state.playing=true; H.onPlayState(state.playing);
    // Depart du chrono de la scene : le pre-rendu est derriere nous, la
    // premiere frame va etre tracee. Deja arme = reprise apres pause, on n'y
    // touche pas.
    if (!state._tlDebutScene) state._tlDebutScene = performance.now();
    H.onTicker();
    const _enCours = H.narration.enCours();
    if (!(state._lectureProjet && _enCours)) {
      const departMs = state.departMs !== undefined ? state.departMs : calculerDepartMsScene(state.sceneIndex ?? 0);
      H.narration.start(departMs);
    }
    animate();
  }

  function _runGroupAt(gpos) {
    if (!state._animGroups || gpos >= state._animGroups.length) { _allLayersDone(); return; }
    state._groupPos = gpos;
  // Position dans la FILE de calques : le nombre de calques des groupes
  // precedents. Elle n'etait jamais mise a jour — elle restait a 0 pour toute
  // la scene. Trois consequences : getCurrentLayer() renvoyait toujours le
  // premier calque quel que soit le groupe en cours, preRender() ne cuisait
  // jamais les calques deja finis dans le fond (slice(0, 0)), et finishAnim()
  // calculait toujours nextPos = 1 — une scene a deux calques rejouait son
  // dernier groupe en boucle.
  state._queuePos = (state._animGroups || []).slice(0, gpos)
                      .reduce((n, g) => n + g.length, 0);
    const group     = state._animGroups[gpos];

    // Pre-build the final image canvas for live reveal blending
    const _imageRevealOn = O.imageReveal !== false;
    const groupHasOutline = group.some(l => {
      const s = l.animStyle || state.animStyle;
      return s === 'illustfill' || s === 'outlinefill' || s === 'brushfill';
    });
    if (_imageRevealOn && groupHasOutline && O.revealStyle !== 'instant') {
      const fc = document.createElement('canvas');
      fc.width = state.canvasW; fc.height = state.canvasH;
      const fctx = fc.getContext('2d');
      // Draw all layers that will be visible at end (bg + current group layers that have reveal on)
      const _tmpBg = state.bgCanvas; state.bgCanvas = null;
      fillBg(fctx);
      state.bgCanvas = _tmpBg;
      if (state.bgCanvas) fctx.drawImage(state.bgCanvas, 0, 0);
      group.forEach(l => {
        if (l.visible === false) return;
        fctx.save();
        fctx.globalAlpha = l.opacity ?? 1;
        fctx.drawImage(l.img, l.x, l.y, l.w, l.h);
        fctx.restore();
      });
      state._revealFinalCanvas = fc;
    } else {
      state._revealFinalCanvas = null;
    }

    // bgCanvas at this point already has all groups before gpos baked in (by finishAnim).
    // For group 0 it is null, so we build a fresh one.
    if (!state.bgCanvas) state.bgCanvas = _buildGroupBgCanvas(gpos);
    const sharedBg = state.bgCanvas;

    // Build a slot for every layer in this group
    state._activeSlots = group.map(layer => {
      const sc = document.createElement('canvas');
      sc.width  = state.canvasW;
      sc.height = state.canvasH;
      const slot = {
        layer,
        canvas: sc,
        ctx:    sc.getContext('2d'),
        offscreen: null,
        done:  false,
        _state: {},
        _saved: {},
      };
      // Seed slot state from current globals, then apply layer overrides.
      // Cette boucle lisait une liste LOCALE vide qui masquait la constante du
      // module : le seeding ne faisait rien et chaque slot demarrait avec un
      // etat de trace incomplet — exactement le defaut que _SLOT_KEYS existe
      // pour fermer.
      _SLOT_KEYS.forEach(k => { slot._state[k] = state[k]; });
      slot._state.animStyle   = layer.animStyle;  // always set — inherited from state at addLayer time
      slot._state.hand        = layer.hand      || state.hand;
      slot._state.zigzag      = layer.zigzag    ?? state.zigzag;
      slot._state.textAnimDir  = layer.textAnimDir  || state.textAnimDir  || 'ltr';
      slot._state.textDrawStyle= layer.textDrawStyle|| state.textDrawStyle|| 'reveal';
      slot._state.outlineDetect   = layer.outlineDetect   ?? state.outlineDetect   ?? 50;
      slot._state.outlineAlgorithm= layer.outlineAlgorithm|| state.outlineAlgorithm|| 'classic';
      slot._state.outlineStrokeStyle = layer.outlineStrokeStyle || state.outlineStrokeStyle || 'default';
      return slot;
    });

    // Pre-render and setup each slot individually
    state._activeSlots.forEach(slot => {
      const _prevStyle = state.animStyle;
      state.animStyle  = slot._state.animStyle;
      state.activeLayerIndex = state.layers.indexOf(slot.layer);

      preRender(sharedBg, slot.layer); // writes offscreen + state.contentBounds for slot.layer
      slot.offscreen         = offscreen;
      slot._state.contentBounds = { ...state.contentBounds };
      state.animStyle = _prevStyle;

      // Push layer-specific slider values, setup the animation style in slot context
      // slot: l'etat vit deja dans `state`
      // resetAnim clears all tick state — good starting point
      cancelAnimationFrame(state.animFrame);
      state.playing = false; state.done = false;
      state.revealCanvas = null; state.edgeCanvas = null;
      state.ofOutlineCanvas = null; state.ofColorCanvas = null;
      state.ofPhase=1; state.ofPerimIdx=0; state.ofFillIdx=0; state.ofLastDrawn=0;
      state.ofColorGroups=null; state.ofColorIdx=0; state.ofWaypointIdx=0; state.ofRevealY=0;
      state.ifOutlineCanvas=null; state.ifColorCanvas=null; state.ifInkCanvas=null;
      state.ifPhase=1; state.ifPerimIdx=0; state.ifLastDrawn=0;
      state.ifInkIdx=0; state.ifInkLastDrawn=0; state.ifInkWaypoints=null;
      state.ifInternalIdx=0; state.ifInternalLast=0;
      state.ifColorGroups=null; state.ifColorIdx=0; state.ifWaypointIdx=0; state.ifRevealY=0;
      state.scribblePhase=0; state.contourPhase=1;
      state.noFlashFinish=false;
      state.stPhase=1; state.stOutlineCanvas=null; state.stOutlinePts=null;
      state.stOutlineIdx=0; state.stOutlineLastDrawn=0; state.stFillPts=null;
      state.curX=0; state.curY=0; state.scanDir=1; state.strokeList=[]; state.strokeIdx=0;

      // Push layer slider values so setupStyle reads them correctly
      state.speed = slot.layer.speed      ?? 40;
      state.handSpeed = slot.layer.handSpeed  ?? 6;
      state.tileSlider = slot.layer.chunks     ?? 30;
      state.specChunks = slot.layer.specChunks ?? 35;

      // Push per-layer stroke style so setup functions read it correctly
      state.outlineStrokeStyle = slot.layer.outlineStrokeStyle || state.outlineStrokeStyle || 'default';

      // L'animation du slot dessine sur SON canvas, pas sur le canvas
      // principal : c'est ce qui permet de composer les calques ensuite.
      const _ctxAvant = ctx, _offAvant = offscreen;
      ctx = slot.ctx; offscreen = slot.offscreen;
      setupStyle();          // ecrit tout l'etat de trace dans state.* depuis offscreen
      slot.anim = anim;      // ... et l'instance appartient au slot
      ctx = _ctxAvant; offscreen = _offAvant;
      _slotOut(slot);        // l'etat frais est range DANS le slot, pas partage
    });

    // Restore offscreen to something valid for legacy checks
    offscreen = state._activeSlots[state._activeSlots.length - 1]?.offscreen ?? offscreen;

    sctx.clearRect(0, 0, state.canvasW, state.canvasH);
    H.onPlayable(true);
    H.onDone(false);
    setProgress(0);
    startAnim();
  }

  function finishAnim() {
    // En lecture projet, l'audio court d'un bout a l'autre : le couper en fin
    // de scene donnait un blanc puis un redemarrage a chaque transition.
    if (!state._lectureProjet) H.narration.stop();
    const slot = state._currentSlot;
    const layer = slot ? slot.layer : state.layers[state.activeLayerIndex];
    const anns = (layer && layer.annotations) ? layer.annotations : [];

    // Reste d'un ancien sequencage annotation-par-annotation : la scene sortait
    // ici tant que state._annIdx < anns.length - 1. Le code qui fait avancer
    // _annIdx vit dans animations.js — or ce fichier n'est PAS charge par l'app,
    // qui tourne sur lib-bundle.js + animations-unified.js. Sur le chemin
    // reellement execute, _annIdx ne vaut donc jamais autre chose que 0 : des
    // qu'un layer portait 2 annotations ou plus, la scene ne se terminait jamais
    // — pas d'enchainement vers la suivante, pas de duree mesuree, curseur
    // plante. Le deroule des regions est gere de bout en bout par
    // l'AnnotationManager de lib/ : quand l'animation finit, la scene est finie.
    if (typeof hctx !== 'undefined' && hctx) hctx.clearRect(0, 0, state.canvasW, state.canvasH);

    // What style just finished?
    const _finishAnimStyle = state.animStyle;
    const _isOutlineOnly   = _finishAnimStyle === 'outlineonly';
    const _isOutlineStyle  = _finishAnimStyle === 'illustfill' || _finishAnimStyle === 'outlinefill' || _finishAnimStyle === 'brushfill';
    const _isSpecText      = _finishAnimStyle === 'spec-text';
    const _textDrawStyle   = state.textDrawStyle || 'reveal';
    const _specTextNoReveal= _isSpecText && _textDrawStyle !== 'reveal';
    const _imageRevealOn   = O.imageReveal !== false;
    const _shouldBakeRawImage = !_isOutlineOnly && !_specTextNoReveal && (!_isOutlineStyle || _imageRevealOn);

    // ── SLOT PATH (parallel animation) ──────────────────────────────────────────
    if (slot) {
      // Bake this slot's completed result into the shared bgCanvas
      if (state.bgCanvas) {
        const bc = state.bgCanvas.getContext('2d');
        const l = slot.layer;
        const srcDrawable = l ? (l.img || l.canvas) : null;
        if (srcDrawable && !_isOutlineOnly) {
          bc.save(); bc.globalAlpha = l.opacity ?? 1;
          bc.drawImage(srcDrawable, l.x, l.y, l.w, l.h);
          bc.restore();
        } else {
          // Bake drawn strokes / fills (no raw image)
          if (state.ifColorCanvas)   bc.drawImage(state.ifColorCanvas,   0, 0);
          if (state.ofColorCanvas)   bc.drawImage(state.ofColorCanvas,   0, 0);
          if (state.ifOutlineCanvas) bc.drawImage(state.ifOutlineCanvas, 0, 0);
          if (state.ofOutlineCanvas) bc.drawImage(state.ofOutlineCanvas, 0, 0);
          if (state.ifInkCanvas)     bc.drawImage(state.ifInkCanvas,     0, 0);
          if (_specTextNoReveal) {
            if (state.revealCanvas)    bc.drawImage(state.revealCanvas,    0, 0);
            if (state.stOutlineCanvas) bc.drawImage(state.stOutlineCanvas, 0, 0);
          }
        }
      }
      // Mark slot done; _tickAllSlots will detect when all slots finish
      slot.done = true;
      hctx.clearRect(0, 0, state.canvasW, state.canvasH);
      setProgress(1);
      return; // _tickAllSlots handles group advancement
    }

    // ── LEGACY SINGLE-SLOT PATH (kept for non-layer / direct use) ───────────────
    if (state.bgCanvas) {
      const bc = state.bgCanvas.getContext('2d');
      const layer = getCurrentLayer();
      const srcDrawable = layer ? (layer.img || layer.canvas) : null;
      if (srcDrawable && !_isOutlineOnly) {
        bc.save(); bc.globalAlpha = (layer.opacity !== undefined ? layer.opacity : 1);
        bc.drawImage(srcDrawable, layer.x, layer.y, layer.w, layer.h);
        bc.restore();
      } else {
        if (state.ifColorCanvas)   bc.drawImage(state.ifColorCanvas,   0, 0);
        if (state.ofColorCanvas)   bc.drawImage(state.ofColorCanvas,   0, 0);
        if (state.ifOutlineCanvas) bc.drawImage(state.ifOutlineCanvas, 0, 0);
        if (state.ofOutlineCanvas) bc.drawImage(state.ofOutlineCanvas, 0, 0);
        if (state.ifInkCanvas)     bc.drawImage(state.ifInkCanvas,     0, 0);
        if (_specTextNoReveal) {
          if (state.revealCanvas)    bc.drawImage(state.revealCanvas,    0, 0);
          if (state.stOutlineCanvas) bc.drawImage(state.stOutlineCanvas, 0, 0);
        }
      }
    }

    // Suppress raw-image flash for non-reveal spec-text and outline-only modes
    if (!state.noFlashFinish && (_imageRevealOn || !_isOutlineStyle) && !_specTextNoReveal) {
      ctx.save(); fillBg(ctx); ctx.drawImage(offscreen,0,0); ctx.restore();
    } else if (_specTextNoReveal) {
      // Composite the drawn strokes as the final frame (no raw image blit)
      ctx.save(); fillBg(ctx);
      if (state.revealCanvas)    ctx.drawImage(state.revealCanvas,    0, 0);
      if (state.stOutlineCanvas) ctx.drawImage(state.stOutlineCanvas, 0, 0);
      ctx.restore();
    }
    hctx.clearRect(0,0,state.canvasW,state.canvasH);
    // Force immediate visual update by triggering a reflow
    if (canvases.hand) void canvases.hand.offsetWidth;
    state.done=true; state.playing=false; H.onPlayState(state.playing);
    setProgress(1);

    const finishedStyle = state.animStyle;
    if (state._savedAnimStyle !== undefined) state.animStyle = state._savedAnimStyle;
    if (state._savedHand      !== undefined) state.hand      = state._savedHand;
    if (state._savedZigzag    !== undefined) state.zigzag    = state._savedZigzag;

    _finDeGroupe(finishedStyle);
  }

  /**
   * Le groupe est fini : on passe au suivant, ou on termine la scene.
   * Partage entre le chemin mono-calque (finishAnim) et le chemin parallele
   * (_tick, quand tous les slots sont finis).
   */
  function _finDeGroupe(finishedStyle) {
    state._activeSlots = [];
    state._currentSlot = null;
    state._slotMode = false;
    // On avance d'un GROUPE. L'ancien calcul partait de _queuePos, la position
    // dans la file de calques, et confondait les deux ("each group is 1 layer") :
    // faux des qu'un groupe en contient plusieurs.
    const nextPos = (state._groupPos ?? 0) + 1;
    if (state._animGroups && nextPos < state._animGroups.length) {
      setTimeout(() => _runGroupAt(nextPos), 200);
    } else {
      // Multi-scene : la scene courante est finie. En lecture projet, on enchaine
      // sur la suivante au lieu d'afficher "Done".
      if (H.onSceneDone()) return;
      H.onPlayhead(-1);
      const loadingBadge = null;
      if (loadingBadge) loadingBadge.style.display = 'none';
      H.onDone(true);
      drawSelectionHandles();
      if ((finishedStyle==='illustfill'||finishedStyle==='outlinefill'||finishedStyle==='brushfill'||finishedStyle==='outlineonly') &&
          (state.ifOutlineCanvas||state.ifInkCanvas||state.ofOutlineCanvas)) {
        _bakeOutlineOverlay();
      }
    }
  }

  function _bakeOutlineOverlay() {
    const ov = H.outlineOverlay();
    // L'hote n'est pas oblige d'offrir un calque de contour : le hook par
    // defaut renvoie null, et le deferencer jetait en pleine fin de scene.
    if (!ov) return;
    ov.width  = state.canvasW;
    ov.height = state.canvasH;
    const oc2 = ov.getContext('2d');
    oc2.clearRect(0,0,state.canvasW,state.canvasH);
    // Illust Fill canvases
    if (state.ifOutlineCanvas) oc2.drawImage(state.ifOutlineCanvas, 0, 0);
    if (state.ifInkCanvas)     oc2.drawImage(state.ifInkCanvas, 0, 0);
    // Outline Fill canvas
    if (state.ofOutlineCanvas) oc2.drawImage(state.ofOutlineCanvas, 0, 0);
    const visible = O.outlineVisible !== false;
    const opacity = (O.outlineOpacity ?? 100) / 100;
    ov.style.display  = visible ? 'block' : 'none';
    ov.style.opacity  = opacity;
  }

  function _allLayersDone() {
    state._activeSlots  = [];
    state._currentSlot  = null;
    state._slotMode     = false;
    ctx = _mainCtx;

    const _imageRevealOn = O.imageReveal !== false;
    const anyOutline = (state._animGroups || []).flat().some(l => {
      const s = l.animStyle || state.animStyle;
      return s === 'illustfill' || s === 'outlinefill' || s === 'brushfill' || s === 'outlineonly';
    });
    const anyOutlineNoReveal = (state._animGroups || []).flat().some(l => {
      const s   = l.animStyle || state.animStyle;
      const sty = l.textDrawStyle || state.textDrawStyle || 'reveal';
      return s === 'outlineonly' || (s === 'spec-text' && sty !== 'reveal') ||
             ((s === 'illustfill' || s === 'outlinefill' || s === 'brushfill') && !_imageRevealOn);
    });

    const shouldReveal = _imageRevealOn && anyOutline && O.revealStyle !== 'instant';

    function _snap() {
      if (anyOutlineNoReveal) {
        if (state.bgCanvas) {
          const _tmpBg = state.bgCanvas; state.bgCanvas = null;
          fillBg(_mainCtx);
          state.bgCanvas = _tmpBg;
        } else {
          fillBg(_mainCtx);
        }
        if (state.bgCanvas) _mainCtx.drawImage(state.bgCanvas, 0, 0);
      }
      state.layers.filter(l => l.visible !== false).forEach(l => {
        _mainCtx.save();
        _mainCtx.globalAlpha = l.opacity ?? 1;
        _mainCtx.drawImage(l.img, l.x, l.y, l.w, l.h);
        _mainCtx.restore();
      });
    }

    if (!shouldReveal) {
      _snap();
      if (H.onSceneDone()) return;
      H.onPlayable(false);
      H.onDone(true);
      H.onStyleLabel('');
      state.done = true;
      return;
    }

    // Reveal animation
    const dur  = Math.max(1, O.revealDuration || 600);
    const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const start = Date.now();

    (function reveal() {
      const el = (Date.now() - start) / dur;
      if (el >= 1) {
        _snap();
        if (H.onSceneDone()) return;
        H.onPlayable(false);
        H.onDone(true);
        H.onStyleLabel('');
        state.done = true;
        return;
      }
      const t = ease(el);
      _mainCtx.save();
      if (state.bgCanvas) {
        const _tmpBg = state.bgCanvas; state.bgCanvas = null;
        fillBg(_mainCtx);
        state.bgCanvas = _tmpBg;
        _mainCtx.drawImage(state.bgCanvas, 0, 0);
      } else {
        fillBg(_mainCtx);
      }
      if (state._revealFinalCanvas && anyOutline && anyOutlineNoReveal) {
        _mainCtx.globalAlpha = t;
        _mainCtx.drawImage(state._revealFinalCanvas, 0, 0);
      }
      if (!anyOutlineNoReveal) {
        _mainCtx.globalAlpha = t;
        state.layers.filter(l => l.visible !== false).forEach(l => {
          _mainCtx.save();
          _mainCtx.globalAlpha *= (l.opacity ?? 1);
          _mainCtx.drawImage(l.img, l.x, l.y, l.w, l.h);
          _mainCtx.restore();
        });
      }
      _mainCtx.restore();
      requestAnimationFrame(reveal);
    })();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Surface publique
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Dessine la scene courante. Adapte de generate() : les parties coquille
   * (toast, fermeture de l'editeur de texte, visibilite multi-scene) sont
   * rendues a l'hote, le reste est identique.
   */
  function demarrer() {
    if (!state.layers.length) return { ok: false, raison: 'aucun calque' };

    state.bgCanvas = null;
    state._annBgCanvas = null;
    state._annIdx = 0;
    state._annAnimSetup = false;
    state._activeSlots = [];
    state._currentSlot = null;
    state._slotMode = false;
    state._revealFinalCanvas = null;
    state._dissolveMap = null;
    state._animProgress = 0;
    state.done = false;
    // Le chrono demarre a la premiere frame, pas ici : le pre-rendu synchrone
    // ne mesure que la temperature des caches, pas la duree du dessin.
    state._tlDebutScene = 0;
    state._tlMesureFaussee = false;

    ctx = _mainCtx;
    fillBg(_mainCtx);
    hctx.clearRect(0, 0, state.canvasW, state.canvasH);

    const allOrdered = getAnimOrder();
    state._animQueue = allOrdered;
    state._queuePos = 0;

    const groupMap = new Map();
    allOrdered.forEach((layer) => {
      const key = layer.animOrder ?? `__${layer.id}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key).push(layer);
    });
    state._animGroups = [...groupMap.values()];
    state._groupPos = 0;

    _runGroupAt(0);
    return { ok: true, groupes: state._animGroups.length };
  }


  /**
   * Le fondu entre deux scenes. Repris de _transitionCanvas() : une photo du
   * canvas sortant est posee par-dessus et son opacite tombe a zero, pendant
   * que la scene entrante s'installe dessous.
   *
   * L'element `wrapper` remplace #canvas-wrapper, et la carte de transition
   * qui s'allumait dans la piste devient un hook : le moteur signale qu'une
   * transition joue, l'hote decide si ca se voit quelque part.
   */
  function transitionCanvas(ms, sceneIdx, pendant, apres) {
    const wrap = canvases.wrapper;
    const main = canvases.main;
    H.onTransition(sceneIdx, ms);

    if (!ms || !wrap || !main) { state._tlEnTransition = false; pendant(); apres(); return; }

    const photo = document.createElement('canvas');
    photo.width = main.width; photo.height = main.height;
    try { photo.getContext('2d').drawImage(main, 0, 0); }
    catch (e) { pendant(); apres(); return; }
    photo.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;' +
                          'pointer-events:none;z-index:60;opacity:1;' +
                          `transition:opacity ${ms}ms linear;`;
    wrap.appendChild(photo);

    pendant();                                  // dessous : le fond de la scene entrante
    requestAnimationFrame(() => { photo.style.opacity = '0'; });

    setTimeout(() => {
      photo.remove();
      state._tlEnTransition = false;
      apres();                                  // le dessin commence maintenant
    }, ms);
  }

  /** Pause/reprise, repris de togglePlay() sans la partie boutons. */
  function basculerPause() {
    if (state.done) { state.playing = false; return demarrer(); }
    state.playing = !state.playing;
    H.onPlayState(state.playing);
    if (state.playing) { animate(); }
    else {
      // Le temps passe en pause n'est pas du temps de dessin : le compter
      // faussait la mesure de la scene.
      state._tlMesureFaussee = true;
      H.narration.stop();
    }
    return { ok: true, playing: state.playing };
  }

  function pause() {
    state.playing = false;
    H.onPlayState(false);
    cancelAnimationFrame(state.animFrame);
  }

  function detruire() {
    cancelAnimationFrame(state.animFrame);
    state.playing = false;
    anim = null;
    offscreen = null;
  }

  return {
    state, options: O,
    demarrer, pause, detruire, transitionCanvas, basculerPause,
    // exposes pour l'hote et pour les tests
    fillBg, preRender, setupStyle, resetAnim, startAnim, animate, setProgress,
    getAnimOrder, detectContentBounds, resScale, resPointScale,
    get animation() { return anim; },
    // la Timeline dessine l'apercu de scrub directement sur ces contextes
    get ctxPrincipal() { return _mainCtx; },
    get ctxHand() { return hctx; },
    get offscreen() { return offscreen; },
  };
}

module.exports = { createEditorEngine, OPTIONS_DEFAUT, HOOKS_DEFAUT, _SLOT_KEYS, _CLES_SCENE };
