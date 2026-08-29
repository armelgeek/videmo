/**
 * Faire tourner EditorEngine sans navigateur : jsdom pour le DOM, node-canvas
 * pour le rendu reel. Meme recette que server/canvas-renderer.js, qui rend
 * deja les videos comme ca.
 *
 * Sert aux tests de parite : depuis que la fenetre Chrome peut se retrouver en
 * arriere-plan — auquel cas requestAnimationFrame est gele et plus rien n'est
 * mesurable — une verification qui exige un navigateur n'est pas fiable.
 */
const { JSDOM } = require('jsdom');
const { createCanvas } = require('canvas');

function installerDOM(width, height) {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.Image = dom.window.Image;

  // jsdom ne sait pas dessiner : chaque <canvas> devient un node-canvas.
  const origCreate = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag, opts) {
    if (typeof tag === 'string' && tag.toLowerCase() === 'canvas') {
      const c = createCanvas(width, height);
      c.style = {};
      c.classList = { add() {}, remove() {}, contains: () => false };
      c.getAttribute = () => null;
      c.setAttribute = () => {};
      c.appendChild = () => {};
      c.remove = () => {};
      return c;
    }
    return origCreate(tag, opts);
  };

  // rAF ET setTimeout pilotes a la main : les tests avancent frame par frame.
  // setTimeout n'est pas un detail — l'avancement d'un groupe de calques a
  // l'autre passe par `setTimeout(() => _runGroupAt(n), 200)`. Sans horloge
  // virtuelle dessus, un rendu multi-groupes s'arrete au premier groupe.
  const files = [];
  let minuteries = [];
  let horloge = 0;
  const FRAME = 1000 / 60;
  global.requestAnimationFrame = (cb) => files.push(cb);
  global.cancelAnimationFrame = () => {};
  global.setTimeout = (cb, ms) => { minuteries.push({ cb, quand: horloge + (ms || 0) }); return minuteries.length; };
  global.clearTimeout = () => {};
  dom.window.requestAnimationFrame = global.requestAnimationFrame;
  dom.window.setTimeout = global.setTimeout;

  return {
    dom,
    /** Joue une frame ; renvoie le nombre de callbacks executes. */
    frame() {
      horloge += FRAME;
      const dues = minuteries.filter((m) => m.quand <= horloge);
      minuteries = minuteries.filter((m) => m.quand > horloge);
      dues.forEach((m) => m.cb());
      const aJouer = files.splice(0, files.length);
      aJouer.forEach((cb) => cb());
      return aJouer.length + dues.length;
    },
    /**
     * Joue jusqu'a `max` frames ou jusqu'a ce que `fini()` soit vrai.
     *
     * On s'arrete quand plus rien n'est EN ATTENTE — ni frame, ni minuterie.
     * S'arreter sur une frame vide serait faux : entre deux groupes de calques
     * le moteur attend 200 ms sans demander une seule frame, et le rendu
     * s'interrompait la, au premier groupe.
     */
    jouer(fini, max = 3000) {
      let n = 0;
      while (n < max && !fini()) {
        if (!files.length && !minuteries.length) break;
        this.frame();
        n++;
      }
      return n;
    },
  };
}

/** Une image de test : un rectangle plein, encre a coup sur. */
function imageCarree(w, h, couleur) {
  const c = createCanvas(w, h);
  const x = c.getContext('2d');
  x.fillStyle = couleur;
  x.fillRect(0, 0, w, h);
  return c;
}

/** Combien de pixels non blancs dans une zone. */
function encre(canvas, x0, y0, w, h) {
  const d = canvas.getContext('2d').getImageData(x0, y0, w, h).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 10 && (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) n++;
  }
  return n;
}

module.exports = { installerDOM, imageCarree, encre, createCanvas };
