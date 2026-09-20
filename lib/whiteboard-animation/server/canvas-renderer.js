const { JSDOM } = require('jsdom');
const { createCanvas, loadImage } = require('canvas');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PassThrough } = require('stream');
const ffmpeg = require('fluent-ffmpeg');
const { fileURLToPath } = require('url');
const { AnimationFactory, CUSTOM_HANDS: HAND_CONFIG, projectAnnotations, handDrawRect } = require('../lib');
const { toNaturalSpace } = require('./region-space');
const { whitenBackground } = require('../lib/white-background');
const { loadSceneImage } = require('./load-image');

/**
 * Copy of the artwork with its background brought to pure white, at natural size.
 *
 * We normalize THE SOURCE, not the output canvas: `preRender` rebuilds the
 * offscreen on every call from `layer.img`, so whitening downstream would be
 * overwritten on the first rebuild.
 */
function _whitenImage(img) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return img;

  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  whitenBackground(ctx, w, h);
  return c;
}

// Hands are declared with a path relative to the web app ('images/x.png').
// Server-side they live in public/images/: resolve to absolute once here,
// rather than gluing '..' back on at load time.
const HANDS_DIR = path.join(process.cwd(), 'public', 'images');
const CUSTOM_HANDS = {};
for (const [key, hand] of Object.entries(HAND_CONFIG)) {
  CUSTOM_HANDS[key] = {
    name: hand.name,
    images: {}
  };
  for (const [res, img] of Object.entries(hand.images)) {
    CUSTOM_HANDS[key].images[res] = {
      ...img,
      path: path.join(HANDS_DIR, path.basename(img.path))
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
      // Hand assets are drawn for the nominal size of their tier
      // (720p/1080p/1440p). If the canvas does not match exactly, they must be
      // scaled: otherwise the hand is out of proportion (a "1080" hand on a
      // 1536x864 canvas is 25% too big). The anchor is scaled too so the tip
      // stays on the stroke.
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

    // A panel carries a WEB path ('/scene.png'), served from public/. As is it
    // would point at the filesystem root. A blob: URL only exists in the tab
    // that created it: it is unrecoverable here, and failing clearly beats a
    // cryptic "File does not exist".
    if (typeof imageSource === 'string' && imageSource.startsWith('blob:')) {
      throw new Error(
        'blob: URL illisible cote serveur — fournir une data: URL ou un filePath public/',
      );
    }
    if (typeof imageSource === 'string' && imageSource.startsWith('/')) {
      const candidate = path.join(process.cwd(), 'public', imageSource);
      if (fs.existsSync(candidate)) imageSource = candidate;
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

    img = _whitenImage(await loadSceneImage(imageSource));
  } catch (err) {
    throw new Error(`Failed to load image: ${err.message}`);
  }

  // Setup offscreen canvas with image
  // The preview fits the artwork with "contain", centered and undistorted
  // (rectContenu). Stretching it to the whole canvas here gave a render that
  // no longer matched what the user had framed.
  const { rectContenu } = require('../canvas-size-runtime');
  const artRect = rectContenu(
    width,
    height,
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
  );

  const offscreenCanvas = createCanvas(width, height);
  const octx = offscreenCanvas.getContext('2d');
  octx.drawImage(img, artRect.x, artRect.y, artRect.w, artRect.h);
  window.offscreen = offscreenCanvas;

  // Process layers and annotations
  if (Array.isArray(animationData.layers) && animationData.layers.length > 0) {
    window.state.layers = await Promise.all(animationData.layers.map(async (l) => {
      let layerImg = null;
      if (l.imageData) {
        try { layerImg = _whitenImage(await loadSceneImage(l.imageData)); } catch (_) {}
      } else if (l.img) {
        try { layerImg = _whitenImage(await loadSceneImage(l.img)); } catch (_) {}
      }
      return {
        id: l.id || 'layer-' + Math.random(),
        name: l.name || 'Layer',
        animStyle: l.animStyle || animationData.animStyle || 'contour',
        opacity: l.opacity !== undefined ? l.opacity : 1,
        x: l.x !== undefined ? l.x : artRect.x,
        y: l.y !== undefined ? l.y : artRect.y,
        w: l.w !== undefined ? l.w : artRect.w,
        h: l.h !== undefined ? l.h : artRect.h,
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
      x: artRect.x, y: artRect.y, w: artRect.w, h: artRect.h,
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
    // Outside the artwork rect there is only background: bounding the engine to
    // the whole canvas made it sweep empty space, as the preview notes.
    window.state.contentBounds = { x: artRect.x, y: artRect.y, w: artRect.w, h: artRect.h };
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

  // BEFORE creating the instance: the Animation constructor only creates its
  // AnnotationManager if state.annotations is already filled. Doing it after
  // left the server render in legacy mode, annotations ignored.
  {
    const activeLayer = window.state.layers[window.state.activeLayerIndex];

    // The editor writes its regions in CANVAS pixels; projectAnnotations expects
    // them in the image's NATURAL pixels. Without this rescale the projection
    // is applied a second time and the regions land in the wrong place.
    const space = animationData.annotationSpace;
    if (space && activeLayer && activeLayer.img) {
      const natural = {
        width: activeLayer.img.naturalWidth || activeLayer.img.width,
        height: activeLayer.img.naturalHeight || activeLayer.img.height,
      };
      activeLayer.annotations = (activeLayer.annotations || []).map((a) =>
        a && a.region
          ? { ...a, region: toNaturalSpace(a.region, space, natural) }
          : a,
      );
    }

    const projected = projectAnnotations(activeLayer);
    window.state.annotations = projected.length
      ? projected
      : (animationData.annotations || []);
    // The narration carries the anchors that sync the drawing to the voice.
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

  // In annotation mode the timeline has its OWN duration (startMs/durationMs):
  // so the clock must advance exactly one frame per video frame, as the
  // preview does. The "ticksPerFrame" heuristic below exists to spread a
  // legacy animation (which has no intrinsic duration) over the requested
  // duration; applying it to annotations scrolled the timeline 8 to 12x too
  // fast, and the video froze after the first tenth.
  const _annotationMode = Array.isArray(window.state.annotations) && window.state.annotations.length > 0;

  // The last tick still places the hand at its final position. Checking it
  // AFTER ticking — not before — is what makes the final image show the
  // drawing alone, like the preview.
  function _clearHandIfDone() {
    if (window.state.done) {
      nodeHandCanvas.getContext('2d').clearRect(0, 0, width, height);
    }
  }

  const renderEngine = {
    seekFrame(frameIdx) {
      if (_annotationMode) {
        // Frame N shows the state AFTER N ticks: frame 0 is therefore the
        // initial state, before any stroke. Ticking before capturing made the
        // video start on an already-begun drawing, whereas the preview shows
        // the pen arriving then writing.
        while (_animTicks < frameIdx && !window.state.done) {
          _tickCurrentStyle(speed);
          _animTicks++;
        }
        // Frame N shows the state after N ticks: on the LAST frame, the tick
        // that triggers finishAnim (and thus clears the hand) never happens.
        // The video therefore froze on the pen resting on the drawing.
        if (frameIdx >= totalFrames - 1) {
          let guard = 0;
          while (!window.state.done && guard++ < fps * 2) {
            _tickCurrentStyle(speed);
            _animTicks++;
          }
        }
        _clearHandIfDone();
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
      _clearHandIfDone();
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

    // toBuffer('raw') is ~40x faster than toBuffer('image/png') (2ms vs 82ms)
    const frameBuffer = compositeCanvas.toBuffer('raw');

    if (onFrameBuffer) {
      // Awaited: this is what applies the ffmpeg stream backpressure.
      const pending = onFrameBuffer(frameBuffer, i, totalFrames);
      if (pending && typeof pending.then === 'function') await pending;
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
 * Prepares the narration track for ffmpeg: returns a local file path, or
 * null if there is no audio. A data URL is written to a temp file.
 * The second element of the pair says whether to delete the file afterwards.
 */
/**
 * Narration beats as local files, ready for ffmpeg.
 *
 * `project.narration.parts` carries the voice as produced: one chunk per
 * beat, placed at its absolute start. The single-track form — an upload, or
 * a project from before the split — becomes a single chunk starting at zero,
 * so the rest of the code does not distinguish.
 */
async function _resolveNarrationParts(project) {
  const narr = project && project.narration;
  const parts = narr && Array.isArray(narr.parts) ? narr.parts : null;

  if (!parts || parts.length === 0) {
    const { filePath, temporary } = await _resolveNarrationAudio(project);
    return filePath ? [{ filePath, temporary, startMs: 0 }] : [];
  }

  const resolved = [];
  for (const part of parts) {
    const { filePath, temporary } = await _resolveNarrationAudio({
      narration: { audioUrl: part.url },
    });
    // An unreadable chunk is skipped, not fatal: the video keeps the other
    // voices at THEIR place, since each delay is absolute.
    if (filePath) resolved.push({ filePath, temporary, startMs: part.startMs || 0 });
  }
  return resolved;
}

async function _resolveNarrationAudio(animationData) {
  const narr = animationData && animationData.narration;
  const src = (narr && narr.audioUrl) || (animationData && animationData.audioUrl);
  if (!src || typeof src !== 'string') return { filePath: null, temporary: false };

  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    const header = src.slice(0, comma);
    if (!/;base64/.test(header)) return { filePath: null, temporary: false };
    const ext = (header.match(/audio\/([a-z0-9]+)/i) || [, 'mp3'])[1].replace('mpeg', 'mp3');
    const filePath = path.join(os.tmpdir(), `sketchpilot-narr-${Date.now()}.${ext}`);
    fs.writeFileSync(filePath, Buffer.from(src.slice(comma + 1), 'base64'));
    return { filePath, temporary: true };
  }
  if (/^https?:/.test(src)) return { filePath: src, temporary: false };   // ffmpeg reads the URL
  return fs.existsSync(src) ? { filePath: src, temporary: false } : { filePath: null, temporary: false };
}

/**
 * Encodes a sequence of raw frames (raw BGRA) into video.
 */
function encodeFrames(frames, outputPath, { width = 1920, height = 1080, fps = 30, audio, audioTemporary, onProgress }) {
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
    const cleanup = () => {
      if (audioTemporary && audio) { try { fs.unlinkSync(audio); } catch (_) {} }
    };
    cmd.outputOptions(options).output(outputPath)
      .on('end', () => { cleanup(); onProgress?.(100); resolve(outputPath); })
      .on('error', (err) => { cleanup(); reject(err); })
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
 * Full video of a multi-scene project, with the global audio muxed.
 */
async function renderProjectToVideo(project, outputPath, { width = 1920, height = 1080, fps = 30, onProgress = null, watermark = null, brandLogoUrl = null } = {}) {
  const { buildProjectSchedule } = require('../lib');
  const { resoudreTransition } = require('../lib/transitions');
  const { createFrameSink } = require('./frame-sink');

  const plan = buildProjectSchedule(project);
  if (!plan.scenes.length) throw new Error('Aucune scene a rendre');

  const { buildNarrationFilter } = require('./narration-mix');
  const narrationParts = await _resolveNarrationParts(project);

  // Rendering and encoding run AT THE SAME TIME: ffmpeg consumes the stream
  // while scenes render. Chaining them would require keeping every frame in
  // memory, which is precisely what this port exists to avoid.
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
    for (const part of narrationParts) cmd.input(part.filePath);

    const mix = buildNarrationFilter(narrationParts);
    options.push('-c:a aac', '-b:a 192k', '-shortest', '-map', '0:v:0');
    if (mix) {
      cmd.complexFilter(mix.filter);
      options.push('-map', mix.sortie);
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

  // Kept so the write loop can die with the encoder.
  let encodingError = null;

  const encoding = new Promise((resolve, reject) => {
    cmd.outputOptions(options).output(outputPath)
      .on('progress', (info) => {
        if (info && info.frames) {
          updateProgress((info.frames / projectTotalFrames) * 95);
        }
      })
      .on('end', resolve)
      .on('error', (err) => { encodingError = err; reject(err); })
      .run();
  });
  // The failure is relayed by the write loop; without this sink, Node would
  // report an unhandled rejection before we get there.
  encoding.catch(() => {});

  // Total frame count across the whole project
  let projectTotalFrames = 0;
  for (let idx = 0; idx < plan.scenes.length; idx++) {
    const s = plan.scenes[idx];
    const next = plan.scenes[idx + 1];
    const sceneEndMs = next ? Math.max(s.endMs, next.startMs - s.transitionMs) : s.endMs;
    const durationMs = Math.max(1, sceneEndMs - s.startMs);
    const animFrameCount = Math.max(1, Math.round(durationMs / 1000 * fps));
    const fadeFrameCount = next && resoudreTransition(s.transitionAfter)
      ? Math.round((s.transitionMs / 1000) * fps)
      : 0;
    projectTotalFrames += animFrameCount + fadeFrameCount;
  }
  projectTotalFrames = Math.max(1, projectTotalFrames);

  let total = 0;
  // A frame written to a full stream is buffered by Node: without waiting for
  // drain, a fast render would rebuild in memory what we just avoided. So we
  // yield to ffmpeg when it falls behind.
  const stamp = await buildFrameStamp({ width, height, watermark, brandLogoUrl });

  const writeFrame = (frame) => {
    if (encodingError) throw encodingError;
    const buf = stamp ? stamp(frame) : frame;
    total++;
    updateProgress((total / projectTotalFrames) * 90);
    if (!inputStream.write(buf)) {
      // Race between drain and encoder death. Waiting only for drain hung the
      // render FOREVER as soon as ffmpeg failed: with nobody reading the
      // stream, the event never came. Observed — two workers stuck 20 minutes
      // in ep_poll, with no output.
      return Promise.race([
        new Promise((r) => inputStream.once('drain', r)),
        encoding.then(
          () => { throw new Error('Encodeur termine avant la fin du rendu'); },
          (err) => { throw err; },
        ),
      ]);
    }
    return null;
  };

  // The emitted fade belongs to the OUTGOING scene. It is set when that scene
  // ends and read when the next one delivers its first frame: writing it at
  // the start of each scene would apply the wrong scene's transition.
  let pendingTransition = null;

  const sink = createFrameSink({
    write: (buf) => writeFrame(buf),
    makeTransitionFrames: async (lastBuf, incomingBuf, n) => {
      // Fade frames are composed here from the raw RGBA buffers
      const fn = resoudreTransition(pendingTransition);
      if (!fn) return [];

      const last = createCanvas(width, height);
      const dCtx = last.getContext('2d');
      const dData = dCtx.createImageData(width, height);
      dData.data.set(lastBuf);
      dCtx.putImageData(dData, 0, 0);

      const incoming = createCanvas(width, height);
      const eCtx = incoming.getContext('2d');
      const eData = eCtx.createImageData(width, height);
      eData.data.set(incomingBuf);
      eCtx.putImageData(eData, 0, 0);

      const out = [];
      for (let k = 0; k < n; k++) {
        const c = createCanvas(width, height);
        const cx = c.getContext('2d');
        cx.fillStyle = '#ffffff';
        cx.fillRect(0, 0, width, height);
        fn(cx, last, incoming, (k + 1) / (n + 1), width, height);
        out.push(c.toBuffer('raw'));
      }
      return out;
    },
  });

  try {
    for (const s of plan.scenes) {
      const scene = s.scene;
      // A scene holds the clock UNTIL the start of the next one, not just until
      // its last annotation: the gap is a pause during which the finished
      // drawing stays on screen. Rendering only endMs - startMs dropped those
      // pauses, and since the audio is global, everything after ran early.
      const next = plan.scenes[s.idx + 1];
      const sceneEndMs = next ? Math.max(s.endMs, next.startMs - s.transitionMs) : s.endMs;
      const durationMs = Math.max(1, sceneEndMs - s.startMs);
      const animFrameCount = Math.max(1, Math.round(durationMs / 1000 * fps));

      await renderAnimationFrames({
        canvasW: width, canvasH: height,
        animStyle: scene.animStyle || project.animStyle || 'contour',
        hand: project.hand || 'custom1',
        handSpeed: project.handSpeed ?? 6,
        speed: project.speed ?? 40,
        tileSlider: project.tileSlider ?? 30,
        canvasImage: scene.canvasImage || scene.image,
        // Coordinate space in which the editor wrote the regions.
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
        width, height, fps, duration: animFrameCount / fps,
        onFrameBuffer: (buf) => sink.sceneFrame(buf, s.idx),
      });

      // Fade frames are only due if there is a next scene.
      const fadeFrameCount = next && resoudreTransition(s.transitionAfter)
        ? Math.round((s.transitionMs / 1000) * fps)
        : 0;
      pendingTransition = s.transitionAfter;
      sink.endScene(s.idx, fadeFrameCount);
    }

    sink.finish();
    inputStream.end();
    await encoding;
  } catch (err) {
    inputStream.destroy();
    throw err;
  } finally {
    for (const part of narrationParts) {
      if (part.temporary) { try { fs.unlinkSync(part.filePath); } catch (_) {} }
    }
  }

  onProgress?.(100);
  return { outputPath, plan, frames: total };
}

async function buildFrameStamp({ width, height, watermark, brandLogoUrl }) {
  const { createWatermarkStamp, createLogoStamp } = require('./watermark');
  if (watermark) return createWatermarkStamp({ width, height, text: watermark });
  if (!brandLogoUrl) return null;
  try {
    return await createLogoStamp({ width, height, logoUrl: brandLogoUrl });
  } catch (err) {
    // A broken logo must not cost the customer their export.
    console.error('[render] brand logo unavailable:', err && err.message);
    return null;
  }
}

/**
 * The exposed API is deliberately limited to these two functions.
 *
 * The original also exposed renderToVideo (single scene) and renderProjectFrames
 * (multi-scene accumulating ALL frames in memory). The first has no caller
 * here; the second contradicts this port's reason to exist, since
 * renderProjectToVideo now streams to ffmpeg. Keeping them would mean
 * maintaining two render paths, one of which cancels the other's benefit.
 */
module.exports = {
  renderAnimationFrames,
  renderProjectToVideo,
};
