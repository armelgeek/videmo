/**
 * Le mix des temps de narration, pour ffmpeg.
 *
 * La voix est produite par temps : la coller en un seul fichier marchait, mais
 * refaire un temps obligeait a tout reconcatener. Ici chaque temps reste une
 * entree, retardee de son debut absolu.
 *
 * `normalize=0` n'est pas un detail : sans lui, amix divise le volume par le
 * nombre d'inputs, et une narration de neuf temps sortirait neuf fois trop
 * faible. Les temps ne se chevauchant pas, il n'y a rien a normaliser.
 */

/**
 * Construit le filtre de mix et le nom de sa sortie.
 *
 * `firstInput` est l'index ffmpeg du premier audio : la video occupe 0.
 * Rend `null` quand un seul temps commence a zero — un simple `-map` suffit
 * alors, et traverser un filtre pour rien reencoderait sans raison.
 */
function buildNarrationFilter(parts, firstInput = 1) {
  if (!Array.isArray(parts) || parts.length === 0) return null;
  if (parts.length === 1 && !parts[0].startMs) return null;

  const branches = parts.map((part, i) => {
    const delay = Math.max(0, Math.round(part.startMs || 0));
    // `all=1` applique le delay a TOUS les canaux : sans lui, ffmpeg ne
    // retarde que le premier et une voix stereo se dedouble en echo.
    return `[${firstInput + i}:a]adelay=${delay}:all=1[n${i}]`;
  });

  const inputs = parts.map((_, i) => `[n${i}]`).join("");
  const mix = `${inputs}amix=inputs=${parts.length}:normalize=0[narration]`;

  return { filter: [...branches, mix].join(";"), sortie: "[narration]" };
}

module.exports = { buildNarrationFilter };
