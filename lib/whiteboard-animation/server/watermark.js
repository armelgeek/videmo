/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS: loaded by the spawned render worker */
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

const FONT_FAMILY = 'WatermarkSans';
let fontRegistered = false;

function ensureFont() {
  if (fontRegistered) return;
  // Alpine images ship no system fonts: without a bundled one the text renders as boxes.
  registerFont(path.join(__dirname, 'fonts', 'watermark-sans-bold.ttf'), { family: FONT_FAMILY });
  fontRegistered = true;
}

/**
 * Returns a function that stamps the label in the bottom-right corner of a raw
 * frame (node-canvas 'raw' layout: premultiplied, 4 bytes per pixel).
 * The input buffer is left untouched: the frame sink keeps it to build transitions.
 */
function createWatermarkStamp({ width, height, text }) {
  ensureFont();
  const fontSize = Math.max(14, Math.round(Math.min(width, height) * 0.032));
  const padX = Math.round(fontSize * 0.6);
  const padY = Math.round(fontSize * 0.35);

  const measure = createCanvas(1, 1).getContext('2d');
  measure.font = `${fontSize}px ${FONT_FAMILY}`;
  const textWidth = Math.ceil(measure.measureText(text).width);

  const w = Math.min(width, textWidth + padX * 2);
  const h = fontSize + padY * 2;
  const margin = Math.round(fontSize * 0.8);
  const x0 = Math.max(0, width - w - margin);
  const y0 = Math.max(0, height - h - margin);

  const patch = createCanvas(w, h);
  const ctx = patch.getContext('2d');
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, padX, h / 2);
  return blendPatch(patch, { width, x0, y0 });
}

/** Stamps an organization logo bottom-right: Enterprise branding in place of the free-plan label. */
async function createLogoStamp({ width, height, logoUrl }) {
  const image = await loadImage(logoUrl);
  const shortSide = Math.min(width, height);
  const maxH = Math.round(shortSide * 0.09);
  const maxW = Math.round(width * 0.22);
  const scale = Math.min(maxH / image.height, maxW / image.width);
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const margin = Math.round(shortSide * 0.03);

  const patch = createCanvas(w, h);
  const ctx = patch.getContext('2d');
  ctx.globalAlpha = 0.9;
  ctx.drawImage(image, 0, 0, w, h);
  return blendPatch(patch, { width, x0: width - w - margin, y0: height - h - margin });
}

function blendPatch(patch, { width, x0, y0 }) {
  const w = patch.width;
  const h = patch.height;
  const src = patch.toBuffer('raw');

  return function stamp(frame) {
    const out = Buffer.from(frame);
    for (let y = 0; y < h; y++) {
      let s = y * w * 4;
      let d = ((y0 + y) * width + x0) * 4;
      for (let x = 0; x < w; x++, s += 4, d += 4) {
        const a = src[s + 3];
        if (a === 0) continue;
        const keep = 255 - a;
        out[d] = src[s] + ((out[d] * keep + 127) / 255 | 0);
        out[d + 1] = src[s + 1] + ((out[d + 1] * keep + 127) / 255 | 0);
        out[d + 2] = src[s + 2] + ((out[d + 2] * keep + 127) / 255 | 0);
        out[d + 3] = a + ((out[d + 3] * keep + 127) / 255 | 0);
      }
    }
    return out;
  };
}

module.exports = { createWatermarkStamp, createLogoStamp };
