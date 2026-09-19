/**
 * Ramene le fond d'un artwork a du blanc PUR.
 *
 * Deux defauts, un seul passage :
 *
 * 1. Fond « presque blanc » (254,254,254) : chaque region revelee posait un
 *    rectangle gris, accentue par le banding h264. Seuil WHITE_THRESHOLD.
 *
 * 2. Fond teinte : les modeles d'image rendent souvent du creme, du gris clair
 *    ou un leger degrade malgre la consigne #FFFFFF. presence-map compte tout
 *    pixel sous 240 comme de l'encre : le fond entier devenait une forme a
 *    dessiner, balayee ou squelettisee par les styles.
 *
 * Pour (2) le fond est estime sur les bords de l'image (profils medians, puis
 * patch de Coons pour suivre un degrade), et chaque pixel est divise par lui,
 * comme un scanner de documents : le fond tombe a 255, l'encre sombre ne bouge
 * pas, l'antialiasing reste continu. Rien n'est touche si les bords ne sont pas
 * un fond uni (photo, cadre plein bord) ou si ce fond est sombre (tableau noir).
 */
const WHITE_THRESHOLD = 250;

// Un fond plus sombre que ca est voulu : le diviser inverserait l'image.
const FOND_MIN = 170;
// Ecart toléré entre un pixel de bord et le fond estime (bruit JPEG, grain).
const TOLERANCE_BORD = 24;
// Part des pixels de bord qui doit ressembler au fond pour le corriger.
const PART_BORD_UNIE = 0.7;
const POINTS_PROFIL = 48;
// Variation maximale d'un degrade le long d'un bord ; au-dela c'est de l'encre.
const ECART_DEGRADE = 40;

function mediane(valeurs) {
  valeurs.sort((a, b) => a - b);
  return valeurs[valeurs.length >> 1];
}

/**
 * Profil d'un bord : `n` points de controle, chacun la mediane RGB d'un segment
 * de la bande. La mediane ignore un trait qui touche le bord.
 * `px(t, k)` rend l'index du pixel a la position t (le long du bord) et a la
 * profondeur k dans la bande.
 */
function profil(d, longueur, epaisseur, px) {
  const n = Math.min(POINTS_PROFIL, longueur);
  // Fenetre large : un trait qui sort du cadre doit y rester minoritaire.
  const demi = Math.max(Math.ceil(longueur / n / 2), Math.round(longueur * 0.06));
  const pts = [];
  for (let s = 0; s < n; s++) {
    const centre = Math.round(((s + 0.5) * longueur) / n);
    const t0 = Math.max(0, centre - demi);
    const t1 = Math.min(longueur, centre + demi + 1);
    const r = [], g = [], b = [];
    for (let t = t0; t < t1; t++) {
      for (let k = 0; k < epaisseur; k++) {
        const i = px(t, k);
        r.push(d[i]); g.push(d[i + 1]); b.push(d[i + 2]);
      }
    }
    pts.push({ c: centre, rgb: [mediane(r), mediane(g), mediane(b)] });
  }
  // Un point tres loin du bord typique est un trait, pas un degrade.
  const ref = [0, 1, 2].map((ch) => mediane(pts.map((p) => p.rgb[ch])));
  for (const p of pts) {
    if (Math.max(...p.rgb.map((v, ch) => Math.abs(v - ref[ch]))) > ECART_DEGRADE) p.rgb = ref.slice();
  }
  const out = new Float32Array(longueur * 3);
  for (let t = 0, s = 0; t < longueur; t++) {
    while (s < pts.length - 2 && pts[s + 1].c < t) s++;
    const a = pts[s], z = pts[Math.min(s + 1, pts.length - 1)];
    const f = z.c > a.c ? Math.min(1, Math.max(0, (t - a.c) / (z.c - a.c))) : 0;
    for (let ch = 0; ch < 3; ch++) out[t * 3 + ch] = a.rgb[ch] + (z.rgb[ch] - a.rgb[ch]) * f;
  }
  return out;
}

/** Fond estime par pixel, ou null si l'image n'a pas de fond clair et uni. */
function estimerFond(d, W, H) {
  if (W < 8 || H < 8) return null;
  const ep = Math.max(1, Math.min(4, Math.round(Math.min(W, H) * 0.01)));
  const haut = profil(d, W, ep, (x, k) => (k * W + x) * 4);
  const bas = profil(d, W, ep, (x, k) => ((H - 1 - k) * W + x) * 4);
  const gauche = profil(d, H, ep, (y, k) => (y * W + k) * 4);
  const droite = profil(d, H, ep, (y, k) => (y * W + (W - 1 - k)) * 4);

  let proches = 0, total = 0;
  const minCanal = [];
  const verifier = (prof, longueur, px) => {
    for (let t = 0; t < longueur; t++) {
      const i = px(t);
      const e = Math.max(
        Math.abs(d[i] - prof[t * 3]),
        Math.abs(d[i + 1] - prof[t * 3 + 1]),
        Math.abs(d[i + 2] - prof[t * 3 + 2]),
      );
      if (e <= TOLERANCE_BORD) proches++;
      total++;
      minCanal.push(Math.min(prof[t * 3], prof[t * 3 + 1], prof[t * 3 + 2]));
    }
  };
  verifier(haut, W, (x) => x * 4);
  verifier(bas, W, (x) => ((H - 1) * W + x) * 4);
  verifier(gauche, H, (y) => y * W * 4);
  verifier(droite, H, (y) => (y * W + W - 1) * 4);
  if (mediane(minCanal) < FOND_MIN || proches / total < PART_BORD_UNIE) return null;

  return { haut, bas, gauche, droite, W, H };
}

/** Blanchit un buffer RGBA sur place. Pur : sert au navigateur, au worker et au serveur. */
function whitenPixels(d, W, H) {
  const fond = estimerFond(d, W, H);
  if (fond) {
    const { haut, bas, gauche, droite } = fond;
    const c00 = [0, 1, 2].map((ch) => (haut[ch] + gauche[ch]) / 2);
    const c10 = [0, 1, 2].map((ch) => (haut[(W - 1) * 3 + ch] + droite[ch]) / 2);
    const c01 = [0, 1, 2].map((ch) => (bas[ch] + gauche[(H - 1) * 3 + ch]) / 2);
    const c11 = [0, 1, 2].map((ch) => (bas[(W - 1) * 3 + ch] + droite[(H - 1) * 3 + ch]) / 2);
    for (let y = 0; y < H; y++) {
      const v = H > 1 ? y / (H - 1) : 0;
      for (let x = 0; x < W; x++) {
        const u = W > 1 ? x / (W - 1) : 0;
        const i = (y * W + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const f =
            (1 - v) * haut[x * 3 + ch] + v * bas[x * 3 + ch] +
            (1 - u) * gauche[y * 3 + ch] + u * droite[y * 3 + ch] -
            ((1 - u) * (1 - v) * c00[ch] + u * (1 - v) * c10[ch] + (1 - u) * v * c01[ch] + u * v * c11[ch]);
          d[i + ch] = Math.min(255, Math.round((d[i + ch] * 255) / Math.max(1, f)));
        }
      }
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    if (d[i] >= WHITE_THRESHOLD && d[i + 1] >= WHITE_THRESHOLD && d[i + 2] >= WHITE_THRESHOLD) {
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
    }
  }
  return !!fond;
}

/**
 * Blanchit sur place le contenu deja dessine dans `ctx`, limite a `rect` (le
 * rectangle de l'artwork : les bandes de letterbox fausseraient l'estimation).
 *
 * Sans effet si le canvas est teinte par une image cross-origin : ce passage
 * est cosmetique, il ne doit jamais casser un rendu.
 */
function whitenBackground(ctx, width, height, rect) {
  const x = rect ? Math.max(0, Math.round(rect.x)) : 0;
  const y = rect ? Math.max(0, Math.round(rect.y)) : 0;
  const w = rect ? Math.min(width - x, Math.round(rect.w)) : width;
  const h = rect ? Math.min(height - y, Math.round(rect.h)) : height;
  if (w <= 0 || h <= 0) return;

  let image;
  try {
    image = ctx.getImageData(x, y, w, h);
  } catch (_) {
    return;
  }
  whitenPixels(image.data, w, h);
  ctx.putImageData(image, x, y);
}

module.exports = { whitenBackground, whitenPixels, WHITE_THRESHOLD };
