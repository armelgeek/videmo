/**
 * Ecrit les frames dans le flux d'encodage au fil de l'eau, en inserant les
 * fondus entre scenes.
 *
 * Accumuler toutes les frames pour pouvoir fondre coutait ~900 buffers PNG sur
 * 30 s en 1080p. Une transition n'a besoin que de la DERNIERE frame sortante et
 * de la PREMIERE entrante : on n'en retient donc que deux.
 */
function createFrameSink({ write, makeTransitionFrames }) {
  let last = null;          // last frame de la scene sortante
  let pendingFade = 0;       // frames de fondu dues avant la scene suivante
  let currentScene = null;

  return {
    /**
     * Rend une promesse si l'un des writes a demande a attendre (flux plein).
     * L'appelant DOIT l'attendre : sans cela les pending s'empilent et le
     * tampon du flux reconstitue en memoire ce que ce sink evite.
     */
    async sceneFrame(buf, sceneIdx) {
      const pending = [];
      const push = (b) => { const r = write(b); if (r && typeof r.then === 'function') pending.push(r); };

      // Premiere frame d'une nouvelle scene : le fondu se glisse AVANT elle.
      // makeTransitionFrames est attendu : composer un fondu suppose de decoder
      // les deux PNG retenus en images, ce qui est asynchrone.
      if (sceneIdx !== currentScene) {
        if (pendingFade > 0 && last) {
          for (const f of await makeTransitionFrames(last, buf, pendingFade)) {
            push(f);
          }
        }
        pendingFade = 0;
        currentScene = sceneIdx;
      }
      push(buf);
      last = buf;

      if (pending.length) await Promise.all(pending);
    },

    endScene(_sceneIdx, transitionFrameCount) {
      pendingFade = transitionFrameCount || 0;
    },

    finish() {
      last = null;
      pendingFade = 0;
      currentScene = null;
    },

    /** Sert au test : le nombre de frames retenues en memoire. */
    heldFrames() {
      return last ? 1 : 0;
    },
  };
}

module.exports = { createFrameSink };
