const fs = require('fs');
const { loadImage } = require('canvas');

/** WebP files start with "RIFF", four size bytes, then "WEBP". */
function isWebp(buf) {
  return (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  );
}

async function bytesOf(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${source}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (source.startsWith('data:')) {
    const comma = source.indexOf(',');
    const header = source.slice(0, comma);
    const body = source.slice(comma + 1);
    return header.endsWith(';base64')
      ? Buffer.from(body, 'base64')
      : Buffer.from(decodeURIComponent(body));
  }
  return fs.readFileSync(source);
}

/**
 * loadImage, WebP compris. node-canvas refuse le WebP (« Unsupported image
 * type ») alors que les illustrations de scene sont desormais stockees ainsi :
 * on le convertit en PNG avant, et tout autre format passe tel quel.
 */
async function loadSceneImage(source) {
  if (typeof source !== 'string') return loadImage(source);
  const bytes = await bytesOf(source);
  if (!isWebp(bytes)) return loadImage(bytes);
  const sharp = require('sharp');
  return loadImage(await sharp(bytes).png().toBuffer());
}

module.exports = { loadSceneImage, isWebp };
