#!/usr/bin/env node
/**
 * Fabrique les demos d'animation montrees sur la landing.
 *
 * POURQUOI
 * Les cartes de la section « Hand animation styles » doivent montrer ce que le
 * moteur produit VRAIMENT. Des apercus dessines a la main dans du CSS derivent
 * du rendu reel des la premiere evolution d'un style, et la vitrine se met a
 * mentir sans que personne s'en apercoive. Ici chaque apercu est un rendu, fait
 * par le meme moteur que les projets des utilisateurs.
 *
 * CE QUE CA PRODUIT, pour chaque style :
 *   public/demos/styles/<style>.mp4    la demo, jouee au survol de la carte
 *   public/demos/styles/<style>.webp   l'image de garde, affichee au repos
 *
 * USAGE
 *   node scripts/generate-style-demos.js
 *   node scripts/generate-style-demos.js --styles chunkjump,brushfill
 *   node scripts/generate-style-demos.js --source mon-dessin.png
 *   node scripts/generate-style-demos.js --keep-source   (garde l'image source)
 *
 * L'image source par defaut est dessinee par ce script : une ampoule, choisie
 * parce qu'elle reunit tout ce qui distingue les styles — du trait continu, une
 * courbe fermee, du line art fin (le filament), des traits detaches (les
 * rayons) et des aplats de couleur. Un dessin plus simple rendrait la moitie
 * des styles indiscernables.
 *
 * PREREQUIS : ffmpeg dans le PATH, et `npm install` fait (canvas, jsdom).
 */

'use strict';

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');
const SORTIE = path.join(RACINE, 'public', 'demos', 'styles');

/**
 * Les styles mis en vitrine.
 *
 * Volontairement plus court que le catalogue du moteur : `specialized` et
 * `spec-text` sont des modes (par variante, par texte) et non des styles de
 * trace, et une carte ne saurait pas les montrer honnetement.
 */
const STYLES = [
  'chunkjump', 'contour', 'scanner', 'outlineonly',
  'illustfill', 'outlinefill', 'brushfill', 'outlinechunks',
  'scribble', 'nervous', 'topanchor', 'gesture', 'skeletontrace',
];

const DEFAUTS = {
  // Le rendu se fait plus grand que l'affichage : la carte fait 320 de large,
  // mais un ecran dense en demande le double.
  rendu: { width: 640, height: 480 },
  affichage: { width: 320, height: 240 },
  fps: 15,
  dureeMs: 3200,
  // L'image de garde est prise pendant le trace, pas a la fin : une carte qui
  // montre le dessin termine ne dit rien du style.
  posterFrame: 22,
  crf: 32,
};

function options(argv) {
  const o = { styles: STYLES, source: null, keepSource: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--styles') o.styles = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--source') o.source = path.resolve(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--keep-source') o.keepSource = true;
    else if (a === '--help' || a === '-h') { o.aide = true; }
  }
  return o;
}

/** Le dessin de reference. Voir l'en-tete pour le choix du sujet. */
function dessinerSource(chemin, W, H) {
  // Charge ici et non en tete : le script doit pouvoir afficher son aide meme
  // si les dependances natives ne sont pas installees.
  const { createCanvas } = require('canvas');
  const c = createCanvas(W, H);
  const x = c.getContext('2d');
  const sx = W / 640;
  const sy = H / 480;
  x.scale(sx, sy);

  x.fillStyle = '#fff';
  x.fillRect(0, 0, 640, 480);
  x.lineCap = 'round';
  x.lineJoin = 'round';
  x.strokeStyle = '#1a1a1a';
  x.lineWidth = 5;

  // Le globe : une courbe fermee et un aplat.
  x.fillStyle = '#ffd60a';
  x.beginPath();
  x.arc(320, 200, 95, 0, Math.PI * 2);
  x.fill();
  x.stroke();

  // Le culot : des traits paralleles rapproches.
  x.fillStyle = '#e8e8e8';
  x.beginPath();
  x.rect(288, 292, 64, 58);
  x.fill();
  x.stroke();
  x.beginPath();
  x.moveTo(288, 308); x.lineTo(352, 308);
  x.moveTo(288, 326); x.lineTo(352, 326);
  x.stroke();

  // Le filament : du line art avec des angles vifs.
  x.beginPath();
  x.moveTo(292, 215); x.lineTo(308, 180); x.lineTo(324, 215);
  x.lineTo(340, 180); x.lineTo(352, 210);
  x.stroke();

  // Les rayons : des traits detaches, qui obligent la main a se lever.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    x.beginPath();
    x.moveTo(320 + Math.cos(a) * 118, 200 + Math.sin(a) * 118);
    x.lineTo(320 + Math.cos(a) * 152, 200 + Math.sin(a) * 152);
    x.stroke();
  }

  // Deux aplats francs : de quoi comparer les remplissages entre eux.
  x.fillStyle = '#2f6fd0';
  x.beginPath(); x.rect(150, 392, 150, 56); x.fill(); x.stroke();
  x.fillStyle = '#3aa76d';
  x.beginPath(); x.rect(340, 392, 150, 56); x.fill(); x.stroke();

  fs.writeFileSync(chemin, c.toBuffer('image/png'));
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
}

async function main() {
  const o = options(process.argv.slice(2));
  if (o.aide) {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^\/\*\*?/, ''));
    return;
  }

  const dest = o.out || SORTIE;
  fs.mkdirSync(dest, { recursive: true });

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-styles-'));
  const source = o.source || path.join(tmp, 'source.png');
  if (!o.source) {
    dessinerSource(source, DEFAUTS.rendu.width, DEFAUTS.rendu.height);
    console.log('source dessinee :', source);
  } else if (!fs.existsSync(source)) {
    console.error('source introuvable :', source);
    process.exitCode = 1;
    return;
  }

  // Charge apres l'aide et apres la validation des arguments : ce require tire
  // tout le moteur, jsdom compris.
  const {
    renderProjectToVideo,
  } = require(path.join(RACINE, 'lib', 'whiteboard-animation', 'server', 'canvas-renderer'));

  const echecs = [];

  for (const style of o.styles) {
    const brut = path.join(tmp, `${style}.mp4`);
    const projet = {
      animStyle: style,
      hand: 'custom1',
      handSpeed: 5,
      speed: 40,
      tileSlider: 30,
      scenes: [{
        id: 'demo',
        canvasImage: source,
        annotations: [{
          region: { x: 0, y: 0, width: DEFAUTS.rendu.width, height: DEFAUTS.rendu.height },
          reveal: { from: 0, to: DEFAUTS.dureeMs },
        }],
      }],
    };

    try {
      const r = await renderProjectToVideo(projet, brut, {
        width: DEFAUTS.rendu.width,
        height: DEFAUTS.rendu.height,
        fps: DEFAUTS.fps,
      });

      const echelle = `scale=${DEFAUTS.affichage.width}:${DEFAUTS.affichage.height}`;
      ffmpeg(['-i', brut, '-vf', echelle, '-an', '-crf', String(DEFAUTS.crf),
              '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
              path.join(dest, `${style}.mp4`)]);
      ffmpeg(['-i', brut, '-vf', `select=eq(n\\,${DEFAUTS.posterFrame}),${echelle}`,
              '-vframes', '1', path.join(dest, `${style}.webp`)]);

      console.log(`${style.padEnd(15)} ${String(r.frames).padStart(3)} images -> mp4 + webp`);
    } catch (e) {
      echecs.push(style);
      console.error(`${style.padEnd(15)} ECHEC : ${e.message}`);
    }
  }

  if (o.keepSource) {
    const garde = path.join(dest, '_source.png');
    fs.copyFileSync(source, garde);
    console.log('source conservee :', garde);
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`\n${o.styles.length - echecs.length}/${o.styles.length} demos ecrites dans ${dest}`);
  if (echecs.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
