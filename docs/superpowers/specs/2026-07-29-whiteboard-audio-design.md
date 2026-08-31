# Whiteboard — Système audio (narration)

Date : 2026-07-29
Statut : conception validée, prêt pour le plan d'implémentation

## Problème

L'éditeur whiteboard n'a aucun audio. Les bornes `reveal.from/to` des annotations
sont décrites comme des timestamps de narration (cf. `AnnotationManager`), mais
aucune bande-son n'existe pour les produire ni pour les vérifier.

Conséquence directe : l'horloge du moteur est le temps mural. La boucle rAF fait
`delta = Math.min(100, now - last)` (`use-whiteboard-renderer.ts:406`), donc toute
frame dépassant 100 ms perd le temps au-delà. Mesuré : le style Illustration met
~16 s à parcourir 11,2 s de timeline. C'est le point 3.2 de
`WHITEBOARD_EDITOR_TODO.md`.

## Objectif

L'audio devient la référence temporelle. Le dessin suit la narration, en aperçu
comme à l'export, et le contrôle du volume est exposé à l'utilisateur.

Hors périmètre de cette itération : musique de fond, effets sonores, pistes
multiples, speech-to-text automatique.

## Décision d'architecture

### L'audio fournit le delta, pas un seek par frame

La première intuition — appeler `seekTo(audioTime)` à chaque frame — est trop
coûteuse. Elle n'est pas nécessaire : la boucle rAF peut rester en place, seule
la **source du delta** change.

```
AVANT : delta = Math.min(100, wallClockNow - wallClockLast)
APRÈS : delta = audioNowMs - lastAudioMs
```

`HTMLAudioElement.currentTime` est en **secondes** ; le moteur attend des
millisecondes. `audio-manager.ts` fait la conversion une fois
(`currentTime * 1000`) et n'expose que des millisecondes, pour qu'aucun
appelant n'ait à s'en souvenir.

L'audio ne dérive pas par rapport à lui-même. Si une frame prend 300 ms, l'audio
a avancé de 300 ms et le moteur reçoit 300 ms. L'écrêtage à 100 ms disparaît :
le point 3.2 du TODO est résolu par cette seule substitution.

### Garde-fou de dérive

Un onglet en arrière-plan ou un décodage bloquant peut désynchroniser malgré
tout. À chaque frame on compare l'horloge du moteur à celle de l'audio ; au-delà
de `DRIFT_MAX_MS = 120`, on déclenche un recalage.

Le recalage réutilise le seek borné qui existe déjà
(`use-whiteboard-renderer.ts:449`) : le rejeu est borné à la durée d'UNE région,
mesuré entre 14 et 34 ms. Aucun nouveau mécanisme n'est nécessaire.

120 ms est en dessous du seuil de perception d'un décalage image/son pour un
tracé (le seuil usuel de détection son-en-retard est ~125 ms).

### Trois modes d'horloge

| Mode | Horloge | Mécanisme |
|---|---|---|
| Aperçu (avec ou sans audio) | temps mural | rAF, delta borné, l'audio est recalé sur le dessin |
| Export | `frame / fps` (absolu) | pas de rAF, dérive structurellement impossible |

Le mode sans audio reste le chemin par défaut tant qu'aucune piste n'est
chargée. Aucune régression pour les projets existants.

> **Révision — l'audio n'est plus l'horloge maîtresse.**
>
> La conception initiale faisait piloter le moteur par `audio.currentTime`,
> pour que la synchro soit vraie par construction. En pratique c'était intenable :
> le moteur d'animation ne tick qu'en avant et ne sait pas sauter, alors qu'un
> élément média bufferise, seek, se bloque et se termine. Chaque accident côté
> audio arrêtait donc le dessin — piste morte, seek qui fait retomber
> `readyState`, audio terminé dont la position se fige, Reset qui laisse
> l'élément en arrière.
>
> Le sens de la dépendance est inversé : **le temps mural possède la timeline,
> et la narration la suit**, recalée seulement au-delà de `DRIFT_MAX_MS`.
> La synchro devient notre responsabilité au lieu d'être gratuite, mais le mode
> de défaillance est bien meilleur : un décalage de 100 ms est un défaut, un gel
> total est un bug bloquant. Mesuré après inversion : écart A/V de 60 à 100 ms
> en lecture normale, et l'animation tourne à 1x identique que l'audio soit sain
> ou totalement mort.
>
> Le delta reste borné (`MAX_FRAME_MS`), non plus pour lisser une frame lente —
> le point 3.2 du TODO — mais pour qu'un onglet en arrière-plan, où rAF s'arrête,
> ne restitue pas tout le temps écoulé en un seul bond au retour.

## Modèle de données

```ts
// lib/whiteboard-animation/audio/types.ts

interface AudioTrack {
  id: string
  url: string            // blob: (upload) ou https: (TTS généré)
  source: 'upload' | 'tts'
  volume: number         // 0..1
  muted: boolean
  offsetMs: number       // décalage si la narration ne démarre pas à 0
  durationMs: number
}

interface TranscriptCue {
  id: string
  startMs: number
  endMs: number
  text: string
  annotationId?: string  // liaison établie manuellement
}
```

Ajouts au store (`WhiteboardConfig`) :

```ts
audio: AudioTrack | null
transcript: TranscriptCue[]
```

Ces deux champs sont persistés. `url` d'un upload est un `blob:` qui ne survit
pas au rechargement : à la réhydratation, une piste `source: 'upload'` dont
l'URL n'est plus résoluble est marquée manquante et l'utilisateur est invité à
la recharger. Les URL `https:` d'une génération TTS survivent normalement.

## Alignement annotation ↔ narration

L'alignement est **manuel**, comme demandé. La transcription horodatée sert de
référence de lecture ; elle n'écrit rien toute seule.

Flux : l'utilisateur importe une transcription, la liste des cues s'affiche à
côté des annotations, et un clic sur « lier » écrit `reveal.from = cue.startMs`
et `reveal.to = cue.endMs` sur l'annotation sélectionnée. La liaison est
enregistrée dans `cue.annotationId` pour être affichée et défaite.

Aucun auto-alignement heuristique dans cette itération.

## Composants

```
audio/audio-manager.ts       Enveloppe HTMLAudioElement : play/pause/seek/volume,
                             émet onTime(ms). Aucune dépendance React.
audio/use-audio-clock.ts     Hook : expose currentTimeMs, isReady, isPlaying.
audio/transcript.ts          Parse JSON/SRT/VTT -> TranscriptCue[]. Pur.
audio/apply-cue.ts           (cue, annotation) -> reveal.from/to. Pur.

components/audio-panel.tsx       Upload/TTS, curseur de volume, muet.
components/transcript-panel.tsx  Liste des cues, liaison vers une annotation.

hooks/use-whiteboard-renderer.ts  MODIFIÉ : delta issu de l'horloge audio,
                                  garde-fou de dérive.
export/                           Boucle en temps absolu, mux de l'audio.
```

`transcript.ts` et `apply-cue.ts` sont des fonctions pures, testables sans DOM ni
canvas. `audio-manager.ts` est testable avec un faux élément audio. Le renderer
reste le seul point qui connaît à la fois le canvas et l'horloge.

## Gestion des erreurs

| Cas | Comportement |
|---|---|
| Aucune piste chargée | Repli temps mural — comportement actuel |
| Échec de chargement | Toast d'erreur, repli temps mural, éditeur utilisable |
| Scrub pendant la lecture | Pause l'audio, seek borné, reprise au relâchement |
| Audio plus court que la timeline | Repli délibéré : passé la fin de l'audio il n'y a plus d'horloge à suivre, le dessin termine en temps mural |
| Audio plus long | Durée = `max(dernière annotation.to, audio.durationMs)` |
| Piste `blob:` non réhydratable | Marquée manquante, invite à recharger le fichier |

## Tests

| Fichier | Couvre |
|---|---|
| `transcript.test.ts` | Parse SRT/VTT/JSON, cues malformées, chevauchements, ordre |
| `apply-cue.test.ts` | Liaison cue→annotation, bornes, cue inversée, cue vide |
| `audio-clock.test.ts` | Math du delta, garde-fou, saut de temps, pause/reprise |
| `audio-sync.test.ts` | Intégration : après 5 s simulées, dérive < 50 ms |

La cible de 50 ms en test est plus stricte que le seuil de recalage de 120 ms :
un test qui ne passe qu'à 119 ms signalerait une régression réelle.

## Séquence d'implémentation

1. `types.ts`, `transcript.ts`, `apply-cue.ts` — unités pures, avec leurs tests
2. `audio-manager.ts` + `use-audio-clock.ts` — horloge, avec tests
3. Champs `audio` / `transcript` dans le store, avec réhydratation
4. `use-whiteboard-renderer.ts` — delta audio + garde-fou (le cœur)
5. `audio-panel.tsx` — upload, volume, muet
6. `transcript-panel.tsx` — liaison des cues
7. Export — boucle en temps absolu et mux audio

Les étapes 1 à 4 rendent le moteur correct ; 5 et 6 le rendent utilisable ; 7
le rend livrable. Chaque étape est vérifiable seule.

## Références

- `WHITEBOARD_EDITOR_TODO.md` §3.2 (delta écrêté), §4 (export et audio)
- `lib/whiteboard-animation/ENGINE_LIMITATIONS.md`
- `use-whiteboard-renderer.ts:406` (boucle rAF), `:449` (seek borné)
