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
    /**
     * Rend une promesse si l'un des writes a demande a attendre (flux plein).
     * L'appelant DOIT l'attendre : sans cela les attentes s'empilent et le
     * tampon du flux reconstitue en memoire ce que ce sink evite.
     */
    async sceneFrame(buf, sceneIdx) {
      const attentes = [];
      const pousser = (b) => { const r = write(b); if (r && typeof r.then === 'function') attentes.push(r); };

      // Premiere frame d'une nouvelle scene : le fondu se glisse AVANT elle.
      // makeTransitionFrames est attendu : composer un fondu suppose de decoder
      // les deux PNG retenus en images, ce qui est asynchrone.
      if (sceneIdx !== sceneCourante) {
        if (fonduEnAttente > 0 && derniere) {
          for (const f of await makeTransitionFrames(derniere, buf, fonduEnAttente)) {
            pousser(f);
          }
        }
        fonduEnAttente = 0;
        sceneCourante = sceneIdx;
      }
      pousser(buf);
      derniere = buf;

      if (attentes.length) await Promise.all(attentes);
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
