/**
 * Resout automatiquement le style d'animation adapte a une annotation.
 *
 * POURQUOI
 * Quand une IA annote une image, elle reconnait la nature de chaque element :
 * un titre, une fleche, un conteneur, une forme pleine ou un dessin. Si le
 * moteur applique aveuglement le meme style de dessin partout (ex: chunkjump
 * ou scanner), le texte est balaye au lieu d'etre ecrit lettre par lettre, et
 * les fleches ne sont pas tracees de la tige vers la pointe.
 *
 * COMMENT
 * Ce routeur sémantique associe a chaque role reconnu par l'IA le geste
 * d'animation optimal du moteur :
 *
 *   - 'title' / 'text' / 'label' ➔ 'spec-text' (ecriture manuscrite mot par mot)
 *   - 'arrow'                    ➔ 'gesture' (trace directionnel fluide)
 *   - revealType === 'fill'      ➔ 'brushfill' (contour puis coups de brosse)
 *   - 'container' / 'shape'      ➔ 'contour' (contour continu ferme)
 *   - 'decoration'               ➔ 'scribble' (croquis rapide / surlignage)
 *   - 'drawing'                  ➔ style par defaut (ex: 'chunkjump' ou 'contour')
 *
 * REGLE DE PRIORITE
 * Si l'utilisateur a explicitement defini un `animStyle` non-vide (autre que
 * 'auto' ou 'default'), son choix manuel prime TOUJOURS sur la deduction IA.
 */

'use strict';

/**
 * Resout le style d'animation selon la semantique de l'annotation.
 *
 * @param {Object} annotation
 * @param {string} [styleParDefaut='chunkjump']
 * @returns {string} le nom du style moteur a instancier (ex: 'spec-text', 'gesture', 'brushfill'...)
 */
function resolveAnnotationStyle(annotation, styleParDefaut = 'chunkjump') {
  if (!annotation) return (styleParDefaut || 'chunkjump').toLowerCase();

  // 1. Choix manuel explicite
  const manuel = (annotation.animStyle || (annotation.style && annotation.style.animStyle) || '').toLowerCase().trim();
  if (manuel && manuel !== 'auto' && manuel !== 'default' && manuel !== 'global') {
    return manuel;
  }

  const role = (annotation.role || '').toLowerCase().trim();
  const objet = (annotation.object || '').toLowerCase().trim();
  const reveal = (annotation.revealType || (typeof annotation.reveal === 'string' ? annotation.reveal : '')).toLowerCase().trim();
  const texte = (annotation.text || '').trim();

  // 2. Remplissages pleins
  if (reveal === 'fill') {
    return 'brushfill';
  }

  // 3. Typographie / Textes
  if (role === 'title' || role === 'text' || role === 'label') {
    return 'spec-text';
  }

  // 4. Fleches et connecteurs
  if (role === 'arrow' || objet.includes('arrow') || objet.includes('fleche') || objet.includes('flèche')) {
    return 'gesture';
  }

  // 5. Conteneurs, cadres et formes geometriques
  if (role === 'container' || role === 'shape') {
    return 'contour';
  }

  // 6. Ratures, hachures et decorations
  if (role === 'decoration') {
    return 'scribble';
  }

  // 7. Presence de texte pur sans objet graphique mentionne
  if (texte && !objet && (!role || role === 'annotation')) {
    return 'spec-text';
  }

  // 8. Repli securise
  return (styleParDefaut || 'chunkjump').toLowerCase();
}

module.exports = {
  resolveAnnotationStyle,
};
