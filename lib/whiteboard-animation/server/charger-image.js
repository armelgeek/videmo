const fs = require('fs');
const { loadImage } = require('canvas');

/** WebP files start with "RIFF", four size bytes, then "WEBP". */
function estWebp(buf) {
  return (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  );
}

async function octetsDe(source) {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${source}`);
    return Buffer.from(await res.arrayBuffer());
  }
  if (source.startsWith('data:')) {
    const virgule = source.indexOf(',');
    const entete = source.slice(0, virgule);
    const corps = source.slice(virgule + 1);
    return entete.endsWith(';base64')
      ? Buffer.from(corps, 'base64')
      : Buffer.from(decodeURIComponent(corps));
  }
  return fs.readFileSync(source);
}

/**
 * loadImage, WebP compris. node-canvas refuse le WebP (« Unsupported image
 * type ») alors que les illustrations de scene sont desormais stockees ainsi :
 * on le convertit en PNG avant, et tout autre format passe tel quel.
 */
async function chargerImage(source) {
  if (typeof source !== 'string') return loadImage(source);
  const octets = await octetsDe(source);
  if (!estWebp(octets)) return loadImage(octets);
  const sharp = require('sharp');
  return loadImage(await sharp(octets).png().toBuffer());
}

module.exports = { chargerImage, estWebp };
