const { JSDOM } = require('jsdom');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const { fileURLToPath } = require('url');
const { AnimationFactory, CUSTOM_HANDS: HAND_CONFIG, projectAnnotations, handDrawRect } = require('../lib');
const { versEspaceNaturel } = require('./region-space');
const { blanchirFond } = require('../lib/fond-blanc');
const { chargerImage } = require('./charger-image');

/**
 * Copie de l'artwork au fond ramene a du blanc pur, a sa taille naturelle.
 *
 * On normalise LA SOURCE et non le canvas de sortie : `preRender` reconstruit
 * l'offscreen a chaque appel depuis `layer.img`, donc blanchir en aval serait
 * ecrase au premier rebuild.
 */
function _blanchirImage(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return img;

  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  blanchirFond(ctx, w, h);
  return c;
}

// Les mains sont declarees avec un chemin relatif a l'app web ('images/x.png').
// Cote serveur elles vivent dans public/images/ : on resout en absolu une fois
// ici, plutot que de recoller des '..' au moment du chargement.
const DOSSIER_MAINS = path.join(process.cwd(), 'public', 'images');
const CUSTOM_HANDS = {};
for (const [key, hand] of Object.entries(HAND_CONFIG)) {
  CUSTOM_HANDS[key] = {
    name: hand.name,
    images: {}
  };
  for (const [res, img] of Object.entries(hand.images)) {
    CUSTOM_HANDS[key].images[res] = {
      ...img,
      path: path.join(DOSSIER_MAINS, path.basename(img.path))
    };
  }
}

const loadedHandImagesCache = new Map();

async function preLoadHandImages(handStyle) {
  const styleKey = CUSTOM_HANDS[handStyle] ? handStyle : 'custom1';
  const handConfig = CUSTOM_HANDS[styleKey];
  for (const [res, imgData] of Object.entries(handConfig.images)) {
    const cacheKey = `${styleKey}_${res}`;
    if (!loadedHandImagesCache.has(cacheKey)) {
      const imagePath = imgData.path;
      if (fs.existsSync(imagePath)) {
        try {
          const img = await loadImage(imagePath);
          loadedHandImagesCache.set(cacheKey, img);
        } catch (_) {}
      }
    }
  }
}

async function renderAnimationFrames(animationData, { width = 1920, height = 1080, fps = 30, duration = 10, onFrame = null, onFrameBuffer = null }) {
  await preLoadHandImages(animationData.hand || 'custom1');
  const totalFrames = Math.ceil(duration * fps);

  // Create minimal DOM environment via jsdom (no real browser, no headless Chrome overhead)
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body>
      <canvas id="main-canvas"></canvas>
      <canvas id="hand-canvas"></canvas>
      <canvas id="outline-overlay"></canvas>
      <div id="play-icon"></div>
      <div id="pause-icon"></div>
      <div id="done-badge"></div>
      <div id="loading-badge"></div>
      <input id="speed-slider" type="range" value="40" />
    </body>
    </html>
  `, {
    pretendToBeVisual: true,
    resources: 'usable',
    runScripts: 'dangerously',
  });

  const { window } = dom;
  const { document } = window;

  // Inject JSDOM window+document into globals so lib/ classes can access them
  global.window = window;
  global.document = document;

  // Inject node-canvas into jsdom's canvas API
  // (jsdom's built-in canvas is limited; we need node-canvas for actual rendering)
  const nodeMainCanvas = createCanvas(width, height);
  const nodeHandCanvas = createCanvas(width, height);

  const mainCanvas = document.getElementById('main-canvas');
  const handCanvas = document.getElementById('hand-canvas');

  // Replace getContext with node-canvas contexts
  mainCanvas.width = width;
  mainCanvas.height = height;
  handCanvas.width = width;
  handCanvas.height = height;

  mainCanvas.getContext = () => nodeMainCanvas.getContext('2d');
  handCanvas.getContext = () => nodeHandCanvas.getContext('2d');

  // Override document.createElement('canvas') to return native node-canvas instances
  const origCreateElement = document.createElement.bind(document);
  document.createElement = function(tagName, options) {
    if (typeof tagName === 'string' && tagName.toLowerCase() === 'canvas') {
      const c = createCanvas(width, height);
      c.style = {};
      c.classList = { add: () => {}, remove: () => {}, contains: () => false };
      c.getAttribute = () => null;
      c.setAttribute = () => {};
      return c;
    }
    return origCreateElement(tagName, options);
  };

  // Setup window globals for animations.js
  window.state = {
    canvasW: width,
    canvasH: height,
    animStyle: animationData.animStyle || 'contour',
    hand: animationData.hand || 'custom1',
    handSpeed: animationData.handSpeed ?? 5,
    speed: animationData.speed ?? 40,
    revealDuration: animationData.revealDuration ?? 1.2,
    departMs: animationData.departMs || 0,
    tileSlider: animationData.tileSlider ?? 30,
    zigzag: animationData.state?.zigzag ?? false,
    outlineDetect: animationData.state?.outlineDetect ?? false,
    colorStyle: animationData.state?.colorStyle || 'original',
    layers: animationData.layers || [],
    contentBounds: null,
    playing: false,
    progress: 0,
    done: false,
  };

  window.ctx = nodeMainCanvas.getContext('2d');
  window.hctx = nodeHandCanvas.getContext('2d');
  window.offscreen = null;

  // Minimal stubs
  window.setProgress = (p) => { window.state.progress = Math.max(0, Math.min(1, p)); };
  window.updatePlayIcons = () => {};
  window.drawSelectionHandles = () => {};
  window.fillBg = (c) => {
    if (window.state._slotMode) { c.clearRect(0, 0, width, height); return; }
    const bg = window.state.canvasBg || { type: 'solid', val: 'white' };
    if (bg.type === 'solid') {
      if (bg.val === 'transparent') { c.clearRect(0, 0, width, height); }
      else { c.fillStyle = (bg.val === 'white') ? '#ffffff' : bg.val; c.fillRect(0, 0, width, height); }
    } else {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, width, height);
    }
    if (window.state.bgCanvas) {
      c.drawImage(window.state.bgCanvas, 0, 0);
    }
    if (window.state._annBgCanvas) {
      c.drawImage(window.state._annBgCanvas, 0, 0);
    }
  };
  window.fillBgOnCtx = (c) => window.fillBg(c);

  // ── Drawing helpers (defined globally in app/index.html, needed by animations.js) ──

  window._strokePencil = (oc, pts, fromIdx, toIdx, color, thickness, JUMP) => {
    const sty = window.state.outlineStrokeStyle || 'default';
    const rs  = window.resScale();
    const bl  = window.resSoftBlur();

    function _isJump(i) {
      if (pts[i].lift) return true;
      if (JUMP === undefined) return false;
      const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
      return Math.sqrt(dx*dx + dy*dy) > JUMP;
    }

    function _doPath(ctx, offX, offY, lw, alpha, sBlur, strokeColor) {
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth   = lw;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = alpha;
      if (sBlur > 0) { ctx.shadowBlur = sBlur; ctx.shadowColor = strokeColor; }
      ctx.beginPath();
      ctx.moveTo(pts[fromIdx].x + offX, pts[fromIdx].y + offY);
      for (let i = fromIdx + 1; i <= toIdx; i++) {
        if (_isJump(i)) {
          ctx.stroke(); ctx.beginPath();
          ctx.moveTo(pts[i].x + offX, pts[i].y + offY);
        } else {
          ctx.lineTo(pts[i].x + offX, pts[i].y + offY);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    if (sty === 'charcoal') {
      _doPath(oc, 0, 0, thickness * 2.8, 0.28, 24 * rs, color);
      _doPath(oc, (Math.random()-0.5)*2.2, (Math.random()-0.5)*2.2, thickness * 1.6, 0.38, 9 * rs, color);
      _doPath(oc, 0, 0, thickness * 0.9, 0.72, 0, color);
      return;
    }
    if (sty === 'multipass') {
      [{ x: 2.8, y: -1.2 }, { x: -2.0, y: 2.4 }, { x: 1.0, y: 1.5 }, { x: 0, y: 0 }]
        .forEach((o, pi) => {
          _doPath(oc, o.x + (Math.random()-0.5)*0.8, o.y + (Math.random()-0.5)*0.8, thickness * 0.52, 0.27 + pi * 0.04, 0, color);
        });
      return;
    }
    if (sty === 'fountain') {
      oc.save();
      oc.strokeStyle = color;
      oc.lineCap  = 'round';
      oc.lineJoin = 'round';
      oc.globalAlpha = 1;
      if (bl > 0) { oc.shadowBlur = bl * 0.5; oc.shadowColor = color; }
      for (let i = fromIdx + 1; i <= toIdx; i++) {
        if (_isJump(i)) continue;
        const dx = pts[i].x - pts[i-1].x, dy = pts[i].y - pts[i-1].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const wt = Math.max(0.3, Math.min(2.4, 8 / (dist + 0.8)));
        oc.lineWidth = thickness * wt;
        oc.beginPath();
        oc.moveTo(pts[i-1].x, pts[i-1].y);
        oc.lineTo(pts[i].x, pts[i].y);
        oc.stroke();
      }
      oc.restore();
      return;
    }
    if (sty === 'blueprint') {
      _doPath(oc, 0, 0, thickness * 2.2, 0.18, 14 * rs, '#ffffff');
      _doPath(oc, 0, 0, thickness * 0.82, 0.96, 2.5 * rs, '#a8d8f0');
      return;
    }
    // default / watercolor — standard clean line
    _doPath(oc, 0, 0, thickness, 1, bl, color);
  };

  window._wcFill = (cc, srcCanvas, cb, revealH) => {
    if (revealH <= 0) return;
    if ((window.state.colorStyle || 'sparse') !== 'watercolor') {
      cc.drawImage(srcCanvas, cb.x, cb.y, cb.w, revealH, cb.x, cb.y, cb.w, revealH);
      return;
    }
    cc.save();
    cc.globalAlpha = 0.42;
    cc.drawImage(srcCanvas, cb.x-5, cb.y-5, cb.w+10, revealH+10, cb.x-5, cb.y-5, cb.w+10, revealH+10);
    cc.globalAlpha = 0.52;
    cc.drawImage(srcCanvas, cb.x, cb.y, cb.w, revealH, cb.x, cb.y, cb.w, revealH);
    cc.restore();
  };

  window._watercolorizeCanvas = (src) => {
    const wc = createCanvas(src.width, src.height);
    const wctx = wc.getContext('2d');
    wctx.globalAlpha = 0.25;
    wctx.drawImage(src, -2, -2, src.width+4, src.height+4);
    wctx.globalAlpha = 0.55;
    wctx.drawImage(src, 0, 0);
    return wc;
  };


  window.drawHand = (hctx, tipX, tipY, dir, handStyle) => {
    if (handStyle === 'ghost') {
      hctx.clearRect(0, 0, width, height);
      return;
    }
    hctx.clearRect(0, 0, width, height);

    const styleKey = CUSTOM_HANDS[handStyle] ? handStyle : (CUSTOM_HANDS[animationData.hand] ? animationData.hand : 'custom1');
    const maxDim = Math.max(width, height);
    const isPortrait = height > width;
    let baseRes = maxDim <= 1280 ? '720' : (maxDim <= 1920 ? '1080' : '1440');
    if (isPortrait) baseRes += 'v';

    const cacheKey = `${styleKey}_${baseRes}`;
    const cachedImg = loadedHandImagesCache.get(cacheKey);
    const handConfig = CUSTOM_HANDS[styleKey] || CUSTOM_HANDS['custom1'];
    const imageConfig = handConfig ? handConfig.images[baseRes] || handConfig.images['720'] : null;

    if (cachedImg && imageConfig) {
      // Les assets de main sont dessines pour la taille nominale de leur palier
      // (720p/1080p/1440p). Si le canvas n'y correspond pas exactement, il faut
      // les mettre a l'echelle : sinon la main est disproportionnee (une main
      // "1080" sur un canvas 1536x864 est 25% trop grande). On met aussi
      // l'ancrage a l'echelle pour que la pointe reste sur le trait.
      const r = handDrawRect(imageConfig, baseRes, tipX, tipY, width, height);
      hctx.save();
      hctx.drawImage(cachedImg, r.x, r.y, r.width, r.height);
      hctx.restore();
    } else {
      // Fallback marker if hand image not available
      hctx.save();
      hctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      hctx.beginPath();
      hctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
      hctx.fill();
      hctx.restore();
    }
  };

  const nodeSketchCanvas = createCanvas(width, height);
  window.sctx = nodeSketchCanvas.getContext('2d');
  window.resScale = () => 1;
  window.resPointScale = () => 1;
  window.resSoftBlur = () => 1;
  window.__virtualTimeMs = 0;
  window.performance = { now: () => window.__virtualTimeMs };

  // Load source image
  if (!animationData.canvasImage) {
    throw new Error('canvasImage URL is required');
  }

  let img;
  try {
    let imageSource = animationData.canvasImage;
    if (typeof imageSource === 'string' && imageSource.startsWith('file://')) {
      imageSource = fileURLToPath(imageSource);
    }

    // Un panneau porte un chemin WEB ('/scene.png'), servi depuis public/. Tel
    // quel il designerait la racine du systeme de fichiers. Une blob: URL, elle,
    // n'existe que dans l'onglet qui l'a creee : elle est irrecuperable ici, et
    // echouer clairement vaut mieux qu'un « File does not exist » enigmatique.
    if (typeof imageSource === 'string' && imageSource.startsWith('blob:')) {
      throw new Error(
        'blob: URL illisible cote serveur — fournir une data: URL ou un chemin public/',
      );
    }
    if (typeof imageSource === 'string' && imageSource.startsWith('/')) {
      const candidat = path.join(process.cwd(), 'public', imageSource);
      if (fs.existsSync(candidat)) imageSource = candidat;
    }

    if (
      typeof imageSource === 'string' &&
      !imageSource.startsWith('http://') &&
      !imageSource.startsWith('https://') &&
      !imageSource.startsWith('data:')
    ) {
      if (!fs.existsSync(imageSource)) {
        throw new Error(`File does not exist: ${imageSource}`);
      }
    }

    img = _blanchirImage(await chargerImage(imageSource));
  } catch (err) {
    throw new Error(`Failed to load image: ${err.message}`);
  }

  // Setup offscreen canvas with image
  // L'apercu ajuste l'artwork en « contain », centre et sans deformation
  // (rectContenu). L'etirer ici au canvas entier donnait un rendu qui ne
  // correspondait plus a ce que l'utilisateur avait cadre.
  const { rectContenu } = require('../canvas-size-runtime');
  const rectArt = rectContenu(
    width,
    height,
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
  );

  const offscreenCanvas = createCanvas(width, height);
  const octx = offscreenCanvas.getContext('2d');
  octx.drawImage(img, rectArt.x, rectArt.y, rectArt.w, rectArt.h);
  window.offscreen = offscreenCanvas;

  // Process layers and annotations
  if (Array.isArray(animationData.layers) && animationData.layers.length > 0) {
    window.state.layers = await Promise.all(animationData.layers.map(async (l) => {
      let layerImg = null;
      if (l.imageData) {
        try { layerImg = _blanchirImage(await chargerImage(l.imageData)); } catch (_) {}
      } else if (l.img) {
        try { layerImg = _blanchirImage(await chargerImage(l.img)); } catch (_) {}
      }
      return {
        id: l.id || 'layer-' + Math.random(),
        name: l.name || 'Layer',
        animStyle: l.animStyle || animationData.animStyle || 'contour',
        opacity: l.opacity !== undefined ? l.opacity : 1,
        x: l.x !== undefined ? l.x : rectArt.x,
        y: l.y !== undefined ? l.y : rectArt.y,
        w: l.w !== undefined ? l.w : rectArt.w,
        h: l.h !== undefined ? l.h : rectArt.h,
        annotations: l.annotations || [],
        narration: l.narration || null,
        img: layerImg || img,
      };
    }));
  } else {
    window.state.layers = [{
      id: 'default-layer',
      name: 'Main Layer',
      animStyle: animationData.animStyle || 'scanner',
      opacity: 1,
      x: rectArt.x, y: rectArt.y, w: rectArt.w, h: rectArt.h,
      annotations: animationData.annotations || [],
      img: img,
    }];
  }
  window.state.activeLayerIndex = 0;

  // Custom preRender using node-canvas for JSDOM compatibility
  window.preRender = (existingBgCanvas) => {
    const layer = window.state.layers[window.state.activeLayerIndex || 0];
    const off = createCanvas(width, height);
    const oc = off.getContext('2d');
    if (layer && layer.img) {
      oc.save();
      oc.globalAlpha = layer.opacity !== undefined ? layer.opacity : 1;
      oc.drawImage(layer.img, layer.x || 0, layer.y || 0, layer.w || width, layer.h || height);
      oc.restore();
    }
    window.offscreen = off;
    // Hors du rectangle d'artwork il n'y a que du fond : borner le moteur au
    // canvas entier le faisait balayer du vide, comme le note l'apercu.
    window.state.contentBounds = { x: rectArt.x, y: rectArt.y, w: rectArt.w, h: rectArt.h };
  };

  // Run preRender to populate initial offscreen canvas
  window.preRender();

  // Boot animation engine using SHARED lib/AnimationFactory
  // Both app/animations.js (frontend) and canvas-renderer.js (backend) use lib/
  let animationInstance = null;
  window.finishAnim = () => {
    window.hctx.clearRect(0, 0, width, height);  // Clear hand canvas at end of animation
    window.state.done = true;
  };

  // AVANT de creer l'instance : le constructeur d'Animation ne cree son
  // AnnotationManager que si state.annotations est deja rempli. Le faire apres
  // laissait le rendu serveur en mode legacy, annotations ignorees.
  {
    const activeLayer = window.state.layers[window.state.activeLayerIndex];

    // L'editeur ecrit ses regions en pixels de CANVAS ; projectAnnotations les
    // attend en pixels NATURELS de l'image. Sans cette remise a l'echelle, la
    // projection s'applique une seconde fois et les regions tombent a cote.
    const espace = animationData.annotationSpace;
    if (espace && activeLayer && activeLayer.img) {
      const naturel = {
        width: activeLayer.img.naturalWidth || activeLayer.img.width,
        height: activeLayer.img.naturalHeight || activeLayer.img.height,
      };
      activeLayer.annotations = (activeLayer.annotations || []).map((a) =>
        a && a.region
          ? { ...a, region: versEspaceNaturel(a.region, espace, naturel) }
          : a,
      );
    }

    const projected = projectAnnotations(activeLayer);
    window.state.annotations = projected.length
      ? projected
      : (animationData.annotations || []);
    // La narration porte les ancres qui synchronisent le dessin sur la voix.
    window.state.narration = (activeLayer && activeLayer.narration)
      || animationData.narration || null;
  }

  try {
    const animStyle = window.state.animStyle || 'scanner';
    const callbacks = {
      fillBg: window.fillBg,
      drawHand: window.drawHand,
      setProgress: window.setProgress,
      finishAnim: window.finishAnim,
      resScale: window.resScale,
      resPointScale: window.resPointScale,
    };

    // Use lib/AnimationFactory (shared source of truth)
    animationInstance = AnimationFactory.create(animStyle, {
      state: window.state,
      ctx: window.ctx,
      hctx: window.hctx,
      offscreen: window.offscreen,
      callbacks,
    });

    if (animationInstance) {
      animationInstance.setup();
    }
  } catch (err) {
    throw new Error(`Animation engine setup failed: ${err.message}`);
  }

  // Deterministic frame-seek API (same as browser version)
  let _animTicks = 0;
  const deltaMs = (1000 / fps); // milliseconds per tick

  function _tickCurrentStyle(speed) {
    if (animationInstance) {
      animationInstance.tick(speed, deltaMs);
    }
  }

  const speed = window.state.speed || 40;

  // En mode annotation la timeline a une duree PROPRE (startMs/durationMs) :
  // il faut donc avancer l'horloge d'exactement une frame par frame video,
  // comme le fait la preview. L'heuristique "ticksPerFrame" ci-dessous existe
  // pour etaler une animation legacy (qui n'a aucune duree intrinseque) sur la
  // duree demandee ; l'appliquer aux annotations faisait defiler la timeline
  // 8 a 12x trop vite, et la video se figeait apres le premier dixieme.
  const _annotationMode = Array.isArray(window.state.annotations) && window.state.annotations.length > 0;

  // Le dernier tick pose encore la main a sa position finale. La verifier
  // APRES avoir ticke — et non avant — est ce qui fait que l'image de fin
  // montre le dessin seul, comme l'apercu.
  function _effacerMainSiFini() {
    if (window.state.done) {
      nodeHandCanvas.getContext('2d').clearRect(0, 0, width, height);
    }
  }

  const renderEngine = {
    seekFrame(frameIdx) {
      if (_annotationMode) {
        // La frame N montre l'etat APRES N ticks : la frame 0 est donc l'etat
        // initial, avant le moindre trait. Ticker avant de capturer faisait
        // demarrer la video sur un dessin deja entame, alors que la preview
        // montre le stylo qui arrive puis ecrit.
        while (_animTicks < frameIdx && !window.state.done) {
          _tickCurrentStyle(speed);
          _animTicks++;
        }
        // La frame N montre l'etat apres N ticks : sur la DERNIERE frame, le
        // tick qui declenche finishAnim (et donc efface la main) n'a jamais
        // lieu. La video se figeait donc sur le stylo pose sur le dessin.
        if (frameIdx >= totalFrames - 1) {
          let garde = 0;
          while (!window.state.done && garde++ < fps * 2) {
            _tickCurrentStyle(speed);
            _animTicks++;
          }
        }
        _effacerMainSiFini();
        return;
      }
      // Spread animation across full duration: more ticks per frame = slower animation
      // Multiplier: 3x more ticks spreads animation 3x longer across the frames
      const baseTicks = Math.max(2, Math.ceil(700 / Math.max(1, totalFrames)));
      const ticksPerFrame = baseTicks * 4; // 4x multiplier for slower reveal
      const targetTick = (frameIdx + 1) * ticksPerFrame;
      while (_animTicks <= targetTick && !window.state.done) {
        _tickCurrentStyle(speed);
        _animTicks++;
      }
      _effacerMainSiFini();
    },
    isComplete() { return window.state.done === true; },
    progress() { return window.state.progress || 0; },
  };

  // Reuse single composite canvas to avoid allocating and freeing thousands of Cairo surface objects
  const compositeCanvas = createCanvas(width, height);
  const fctx = compositeCanvas.getContext('2d');

  const frames = [];
  for (let i = 0; i < totalFrames; i++) {
    window.__virtualTimeMs = (i / fps) * 1000;
    renderEngine.seekFrame(i);

    // 1. Opaque white background (prevents FFmpeg transparent black artifacts)
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, width, height);

    // 2. Main whiteboard illustration layer
    fctx.drawImage(nodeMainCanvas, 0, 0);

    // 3. Hand animation layer on top
    fctx.drawImage(nodeHandCanvas, 0, 0);

    // toBuffer('raw') est ~40x plus rapide que toBuffer('image/png') (2ms vs 82ms)
    const frameBuffer = compositeCanvas.toBuffer('raw');

    if (onFrameBuffer) {
      // Attendu : c'est ce qui applique la contre-pression du flux ffmpeg.
      const attente = onFrameBuffer(frameBuffer, i, totalFrames);
      if (attente && typeof attente.then === 'function') await attente;
    } else {
      frames.push(frameBuffer);
    }

    if (onFrame) {
      onFrame(i, totalFrames);
    }
  }

  return frames;
}


/**
 * Prepare la piste narration pour ffmpeg : renvoie un chemin de fichier local,
 * ou null s'il n'y a pas d'audio. Une data URL est ecrite dans un temporaire.
 * Le second element du couple indique s'il faut supprimer le fichier apres.
 */
/**
 * Les temps de narration en fichiers locaux, prets pour ffmpeg.
 *
 * `project.narration.parts` porte la voix telle qu'elle est produite : un
 * morceau par temps, place a son debut absolu. La forme a une seule piste —
 * un televersement, ou un projet d'avant le decoupage — devient un unique
 * morceau qui part de zero, si bien que le reste du code ne distingue pas.
 */
async function _resoudreNarrationParts(project) {
  const narr = project && project.narration;
  const parts = narr && Array.isArray(narr.parts) ? narr.parts : null;

  if (!parts || parts.length === 0) {
    const { chemin, temporaire } = await _resoudreAudioNarration(project);
    return chemin ? [{ chemin, temporaire, startMs: 0 }] : [];
  }

  const resolus = [];
  for (const part of parts) {
    const { chemin, temporaire } = await _resoudreAudioNarration({
      narration: { audioUrl: part.url },
    });
    // Un morceau illisible est saute, pas fatal : la video garde les autres
    // voix a LEUR place, puisque chaque retard est absolu.
    if (chemin) resolus.push({ chemin, temporaire, startMs: part.startMs || 0 });
  }
  return resolus;
}

async function _resoudreAudioNarration(animationData) {
  const narr = animationData && animationData.narration;
  const src = (narr && narr.audioUrl) || (animationData && animationData.audioUrl);
  if (!src || typeof src !== 'string') return { chemin: null, temporaire: false };

  if (src.startsWith('data:')) {
    const virgule = src.indexOf(',');
    const entete = src.slice(0, virgule);
    if (!/;base64/.test(entete)) return { chemin: null, temporaire: false };
    const ext = (entete.match(/audio\/([a-z0-9]+)/i) || [, 'mp3'])[1].replace('mpeg', 'mp3');
    const chemin = path.join(os.tmpdir(), `sketchpilot-narr-${Date.now()}.${ext}`);
    fs.writeFileSync(chemin, Buffer.from(src.slice(virgule + 1), 'base64'));
    return { chemin, temporaire: true };
  }
  if (/^https?:/.test(src)) return { chemin: src, temporaire: false };   // ffmpeg lit l'URL
  return fs.existsSync(src) ? { chemin: src, temporaire: false } : { chemin: null, temporaire: false };
}

/**
 * Encode une suite de frames brutes (raw BGRA) en video.
 */
function encoderFrames(frames, outputPath, { width = 1920, height = 1080, fps = 30, audio, audioTemporaire, onProgress }) {
  return new Promise((resolve, reject) => {
    const inputStream = new PassThrough();
    inputStream.setMaxListeners(0);
    const cmd = ffmpeg(inputStream)
      .inputFormat('rawvideo')
      .inputOptions([
        '-pixel_format', 'bgra',
        '-video_size', `${width}x${height}`,
      ])
      .inputFPS(fps);

    const options = [
      '-c:v libx264',
      '-preset ultrafast',
      '-threads 0',
      '-crf 23',
      '-pix_fmt yuv420p',
      '-movflags +faststart',
    ];

    if (audio) {
      cmd.input(audio);
      options.push('-c:a aac', '-b:a 192k', '-shortest', '-map', '0:v:0', '-map', '1:a:0');
    }
    const nettoyer = () => {
      if (audioTemporaire && audio) { try { fs.unlinkSync(audio); } catch (_) {} }
    };
    cmd.outputOptions(options).output(outputPath)
      .on('end', () => { nettoyer(); onProgress?.(100); resolve(outputPath); })
      .on('error', (err) => { nettoyer(); reject(err); })
      .run();

    (async () => {
      try {
        for (const buf of frames) inputStream.write(buf);
        inputStream.end();
      } catch (err) { inputStream.destroy(); reject(err); }
    })();
  });
}

/**
 * Video complete d'un projet multi-scene, avec l'audio global muxe.
 */
async function renderProjectToVideo(project, outputPath, { width = 1920, height = 1080, fps = 30, onProgress = null } = {}) {
  const { buildProjectSchedule } = require('../lib');
  const { resoudreTransition } = require('../lib/transitions');
  const { createFrameSink } = require('./frame-sink');

  const plan = buildProjectSchedule(project);
  if (!plan.scenes.length) throw new Error('Aucune scene a rendre');

  const { buildNarrationFilter } = require('./narration-mix');
  const narrationParts = await _resoudreNarrationParts(project);

  // Rendu et encodage tournent EN MEME TEMPS : ffmpeg consomme le flux pendant
  // que les scenes se rendent. Les enchainer imposerait de garder toutes les
  // frames en memoire, ce que ce port existe justamente pour eviter.
  const inputStream = new PassThrough();
  inputStream.setMaxListeners(0);

  const cmd = ffmpeg(inputStream)
    .inputFormat('rawvideo')
    .inputOptions([
      '-pixel_format', 'bgra',
      '-video_size', `${width}x${height}`,
    ])
    .inputFPS(fps);

  const options = [
    '-c:v libx264',
    '-preset ultrafast',
    '-threads 0',
    '-crf 23',
    '-pix_fmt yuv420p',
    '-movflags +faststart',
  ];

  if (narrationParts.length > 0) {
    for (const part of narrationParts) cmd.input(part.chemin);

    const melange = buildNarrationFilter(narrationParts);
    options.push('-c:a aac', '-b:a 192k', '-shortest', '-map', '0:v:0');
    if (melange) {
      cmd.complexFilter(melange.filter);
      options.push('-map', melange.sortie);
    } else {
      options.push('-map', '1:a:0');
    }
  }

  let maxProgress = 0;
  const updateProgress = (val) => {
    const next = Math.min(99, Math.max(maxProgress, Math.round(val)));
    if (next > maxProgress) {
      maxProgress = next;
      onProgress?.(maxProgress);
    }
  };

  // Retenu pour que la boucle d'ecriture puisse mourir avec l'encodeur.
  let echecEncodage = null;

  const encodage = new Promise((resolve, reject) => {
    cmd.outputOptions(options).output(outputPath)
      .on('progress', (info) => {
        if (info && info.frames) {
          updateProgress((info.frames / totalFramesProjet) * 95);
        }
      })
      .on('end', resolve)
      .on('error', (err) => { echecEncodage = err; reject(err); })
      .run();
  });
  // L'echec est relaye par la boucle d'ecriture ; sans ce puits, Node
  // signalerait une rejection non geree avant qu'on y arrive.
  encodage.catch(() => {});

  // Calcul du nombre total de frames sur l'ensemble du projet
  let totalFramesProjet = 0;
  for (let idx = 0; idx < plan.scenes.length; idx++) {
    const s = plan.scenes[idx];
    const suivante = plan.scenes[idx + 1];
    const finMs = suivante ? Math.max(s.endMs, suivante.startMs - s.transitionMs) : s.endMs;
    const dureeMs = Math.max(1, finMs - s.startMs);
    const nbAnim = Math.max(1, Math.round(dureeMs / 1000 * fps));
    const nbFondu = suivante && resoudreTransition(s.transitionAfter)
      ? Math.round((s.transitionMs / 1000) * fps)
      : 0;
    totalFramesProjet += nbAnim + nbFondu;
  }
  totalFramesProjet = Math.max(1, totalFramesProjet);

  let total = 0;
  // Une frame ecrite sur un flux plein est mise en tampon par Node : sans
  // attendre le drain, un rendu rapide reconstituerait en memoire ce qu'on
  // vient d'eviter. On rend donc la main a ffmpeg quand il est en retard.
  const ecrire = (buf) => {
    if (echecEncodage) throw echecEncodage;
    total++;
    updateProgress((total / totalFramesProjet) * 90);
    if (!inputStream.write(buf)) {
      // Course entre le drain et la mort de l'encodeur. N'attendre que le drain
      // suspendait le rendu POUR TOUJOURS des que ffmpeg echouait : plus
      // personne ne lisant le flux, l'evenement n'arrivait jamais. Observe —
      // deux workers bloques 20 minutes en ep_poll, sans aucune sortie.
      return Promise.race([
        new Promise((r) => inputStream.once('drain', r)),
        encodage.then(
          () => { throw new Error('Encodeur termine avant la fin du rendu'); },
          (err) => { throw err; },
        ),
      ]);
    }
    return null;
  };

  // Le fondu emis appartient a la scene SORTANTE. Il est pose quand celle-ci
  // s'acheve et lu quand la suivante livre sa premiere frame : l'ecrire au
  // debut de chaque scene appliquerait la transition de la mauvaise.
  let transitionEnAttente = null;

  const sink = createFrameSink({
    write: (buf) => ecrire(buf),
    makeTransitionFrames: async (derniereBuf, entranteBuf, n) => {
      // Les frames de fondu sont composees ici a partir des buffers bruts RGBA
      const fn = resoudreTransition(transitionEnAttente);
      if (!fn) return [];

      const derniere = createCanvas(width, height);
      const dCtx = derniere.getContext('2d');
      const dData = dCtx.createImageData(width, height);
      dData.data.set(derniereBuf);
      dCtx.putImageData(dData, 0, 0);

      const entrante = createCanvas(width, height);
      const eCtx = entrante.getContext('2d');
      const eData = eCtx.createImageData(width, height);
      eData.data.set(entranteBuf);
      eCtx.putImageData(eData, 0, 0);

      const out = [];
      for (let k = 0; k < n; k++) {
        const c = createCanvas(width, height);
        const cx = c.getContext('2d');
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, width, height);
        fn(cx, derniere, entrante, (k + 1) / (n + 1), width, height);
        out.push(c.toBuffer('raw'));
      }
      return out;
    },
  });

  try {
    for (const s of plan.scenes) {
      const scene = s.scene;
      // Une scene occupe l'horloge JUSQU'AU debut de la suivante, pas seulement
      // jusqu'a sa derniere annotation : l'ecart est une pause pendant laquelle
      // le dessin acheve reste a l'ecran. Ne rendre que endMs - startMs
      // escamotait ces pauses, et comme l'audio est global, tout ce qui suivait
      // partait en avance.
      const suivante = plan.scenes[s.idx + 1];
      const finMs = suivante ? Math.max(s.endMs, suivante.startMs - s.transitionMs) : s.endMs;
      const dureeMs = Math.max(1, finMs - s.startMs);
      const nbAnim = Math.max(1, Math.round(dureeMs / 1000 * fps));

      await renderAnimationFrames({
        canvasW: width, canvasH: height,
        animStyle: scene.animStyle || project.animStyle || 'contour',
        hand: project.hand || 'custom1',
        handSpeed: project.handSpeed ?? 6,
        speed: project.speed ?? 40,
        tileSlider: project.tileSlider ?? 30,
        canvasImage: scene.canvasImage || scene.image,
        // Repere dans lequel l'editeur a ecrit les regions.
        annotationSpace: project.annotationSpace || null,
        departMs: s.startMs,
        narration: project.narration || null,
        layers: scene.layers || [{
          id: scene.id || 'scene', name: scene.id || 'scene',
          animStyle: scene.animStyle || project.animStyle || 'contour',
          x: 0, y: 0, w: width, h: height,
          imageData: scene.imageData || scene.image,
          annotations: scene.annotations || [],
        }],
        state: project.state || {},
      }, {
        width, height, fps, duration: nbAnim / fps,
        onFrameBuffer: (buf) => sink.sceneFrame(buf, s.idx),
      });

      // Les frames de fondu ne sont dues que s'il y a une scene suivante.
      const nbFondu = suivante && resoudreTransition(s.transitionAfter)
        ? Math.round((s.transitionMs / 1000) * fps)
        : 0;
      transitionEnAttente = s.transitionAfter;
      sink.endScene(s.idx, nbFondu);
    }

    sink.finish();
    inputStream.end();
    await encodage;
  } catch (err) {
    inputStream.destroy();
    throw err;
  } finally {
    for (const part of narrationParts) {
      if (part.temporaire) { try { fs.unlinkSync(part.chemin); } catch (_) {} }
    }
  }

  onProgress?.(100);
  return { outputPath, plan, frames: total };
}

/**
 * L'API exposee se limite volontairement a ces deux fonctions.
 *
 * L'original exposait aussi renderToVideo (scene unique) et renderProjectFrames
 * (multi-scene accumulant TOUTES les frames en memoire). La premiere n'a aucun
 * appelant ici ; la seconde contredit la raison d'etre de ce port, puisque
 * renderProjectToVideo streame desormais vers ffmpeg. Les garder reviendrait a
 * maintenir deux chemins de rendu dont l'un annule le benefice de l'autre.
 */
module.exports = {
  renderAnimationFrames,
  renderProjectToVideo,
};
