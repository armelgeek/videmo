/**
 * Inkplainer Core Animation Engine
 * Handles image outline detection, stroke chunking, hand trajectory, and frame rendering.
 */

export interface InkplainerLayer {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  visible: boolean;
  animStyle: string;
  handStyle: string;
  speed: number;
  handSpeed: number;
  imageElement?: HTMLImageElement;
  annotations?: Array<{ id: string; name: string }>;
}

export interface InkplainerEngineState {
  layers: InkplainerLayer[];
  selectedLayerId: string | null;
  canvasW: number;
  canvasH: number;
  canvasBg: string;
  isPlaying: boolean;
  progress: number;
  animStyle: string;
  handStyle: string;
  revealSpeed: number;
  handSpeed: number;
}

/**
 * Render a complete layer (with actual HTMLImageElement if available) onto main canvas context
 */
export function drawLayerToCanvas(
  ctx: CanvasRenderingContext2D,
  layer: InkplainerLayer,
  progressPct: number
) {
  ctx.save();
  ctx.globalAlpha = layer.opacity;

  // Progressive reveal clip mask
  const revealW = (layer.w * progressPct) / 100;
  ctx.beginPath();
  ctx.rect(layer.x, layer.y, revealW, layer.h);
  ctx.clip();

  if (layer.imageElement && layer.imageElement.complete) {
    // Draw the actual scene-premium-bag.png image
    ctx.drawImage(layer.imageElement, layer.x, layer.y, layer.w, layer.h);
  } else {
    // Fallback sketch graphics
    ctx.fillStyle = '#1a1a1a';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;

    ctx.strokeRect(layer.x, layer.y, layer.w, layer.h);

    ctx.beginPath();
    ctx.moveTo(layer.x, layer.y);
    ctx.lineTo(layer.x + layer.w, layer.y + layer.h);
    ctx.moveTo(layer.x + layer.w, layer.y);
    ctx.lineTo(layer.x, layer.y + layer.h);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Render Hand Sprite on Hand Overlay Canvas
 */
export function drawHandSprite(
  hctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  handStyle: string
) {
  hctx.save();
  hctx.translate(x, y);

  if (handStyle === 'pen') {
    // Blue fountain pen
    hctx.fillStyle = '#2563eb';
    hctx.beginPath();
    hctx.moveTo(0, 0);
    hctx.lineTo(20, -45);
    hctx.lineTo(32, -35);
    hctx.closePath();
    hctx.fill();

    // Pen tip nib
    hctx.fillStyle = '#1e293b';
    hctx.beginPath();
    hctx.moveTo(0, 0);
    hctx.lineTo(5, -12);
    hctx.lineTo(-2, -12);
    hctx.closePath();
    hctx.fill();
  } else if (handStyle !== 'ghost') {
    // Realistic hand silhouette / stylus
    hctx.fillStyle = '#0f172a';
    hctx.beginPath();
    hctx.arc(16, 16, 15, 0, Math.PI * 2);
    hctx.fill();

    hctx.strokeStyle = '#ffffff';
    hctx.lineWidth = 2.5;
    hctx.beginPath();
    hctx.moveTo(0, 0);
    hctx.lineTo(16, 16);
    hctx.stroke();

    // Drop shadow
    hctx.fillStyle = 'rgba(0,0,0,0.15)';
    hctx.beginPath();
    hctx.ellipse(20, 30, 18, 6, 0, 0, Math.PI * 2);
    hctx.fill();
  }

  hctx.restore();
}
