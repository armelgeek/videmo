/**
 * Ecrit les frames dans le flux d'encodage au fil de l'eau, en inserant les
 * fondus entre scenes.
 *
 * Accumuler toutes les frames pour pouvoir fondre coutait ~900 buffers PNG sur
 * 30 s en 1080p. Une transition n'a besoin que de la DERNIERE frame sortante et
 * de la PREMIERE entrante : on n'en retient donc que deux.
 */
function createFrameSink({ write, makeTransitionFrames }) {
  let derniere = null;          // derniere frame de la scene sortante
  let fonduEnAttente = 0;       // frames de fondu dues avant la scene suivante
  let sceneCourante = null;

  return {
    sceneFrame(buf, sceneIdx) {
      // Premiere frame d'une nouvelle scene : le fondu se glisse AVANT elle.
      if (sceneIdx !== sceneCourante) {
        if (fonduEnAttente > 0 && derniere) {
          for (const f of makeTransitionFrames(derniere, buf, fonduEnAttente)) write(f);
        }
        fonduEnAttente = 0;
        sceneCourante = sceneIdx;
      }
      write(buf);
      derniere = buf;
    },

    endScene(_sceneIdx, transitionFrameCount) {
      fonduEnAttente = transitionFrameCount || 0;
    },

    finish() {
      derniere = null;
      fonduEnAttente = 0;
      sceneCourante = null;
    },

    /** Sert au test : le nombre de frames retenues en memoire. */
    heldFrames() {
      return derniere ? 1 : 0;
    },
  };
}

module.exports = { createFrameSink };
