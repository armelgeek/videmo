# Narration par temps de narration, et annotations calées sur la voix

> **Pour les agents :** les étapes utilisent des cases à cocher (`- [ ]`). Les
> modules purs sont écrits et testés seuls avant de toucher à la page.

**But :** produire la voix par *temps de narration* plutôt que par image, afin
que chaque annotation entre exactement quand son texte est dit.

**Pourquoi maintenant :** tout le reste est en place et testé. Il ne manque que
ce découpage pour que la chaîne aille du prompt à une vidéo réellement calée.

---

## Ce qui est déjà fait

| Étape | Route | État |
|---|---|---|
| Script (texte pur) | `/api/generate-script` | ✅ |
| Découpage en images + temps | `/api/generate-storyboard` | ✅ |
| Visuels | `/api/generate-images` | ✅ |
| Voix | `/api/generate-narration` | ✅ **par image** |
| Régions + calage | `/api/plan-annotations` | ✅ non branché |

Modules purs testés : `lib/storyboard/script-generation.ts` (beats, durées),
`lib/storyboard/annotation-planning.ts` (régions, timings),
`lib/speech/audio-duration.ts` (ffprobe), `lib/image/region-reader.ts` (vision).

Abstractions par fournisseur, toutes sur le même patron — interface, adaptateur,
double de test : `lib/storage`, `lib/image`, `lib/speech`.

---

## Le problème à résoudre

`handleVoiceSelected` (page storyboard) génère **un MP3 par image**, à partir de
`clip.summary` — la narration entière de l'image.

Or `planAnnotations` a besoin de la durée de **chaque temps** pour placer les
entrées. Sans elles, il retombe sur l'estimation du découpage.

**Mesure, sur une seule phrase :**

| | Durée |
|---|---|
| Estimation du découpage (3 mots/s) | ~5700 ms |
| Audio réellement produit | **6552 ms** |

15 % d'écart. Sur un script de neuf temps, la dérive cumulée approche **sept
secondes** : le stylo dessine une zone pendant que la voix parle déjà de la
suivante.

**Le découpage par temps ne coûte pas plus cher.** Le TTS est facturé au
caractère : neuf appels sur le même texte valent cinq appels sur le même texte.

---

## Contraintes

- La voix se génère **avant** les annotations. L'ordre est imposé par la mesure :
  `script → découpage → images → voix → annotations`.
- Les durées sont en millisecondes, entières, partout.
- `measureAudioDurationMs` peut échouer (ffprobe absent en production) : le
  calage retombe alors sur l'estimation, jamais sur une erreur.
- Une image sans région lue garde l'image entière : mieux vaut une zone trop
  large qu'une scène où rien ne se dessine.
- Fichiers et tests côte à côte (`foo.ts` + `foo.test.ts`).
- Aucune nouvelle dépendance.

---

## Tâches

### 1. Porter l'audio sur le temps de narration

- [x] Étendre `scriptBeatSchema` (`lib/storyboard/script-generation.ts`) avec
      `audioUrl?: string` et `audioDurationMs?: number`.
- [x] Tests : un temps sans audio reste valide ; un temps avec audio conserve
      ses deux champs à l'aller-retour.
- [x] Vérifier que `storyboardPanelSchema` accepte les beats enrichis, sinon
      l'enregistrement les perdrait en silence (`z.object` retire ce qu'il ne
      déclare pas — c'est déjà arrivé sur `promptContent`).
      **Le piège était réel** : `beats` n'était pas déclaré, et `syncClipsToStore`
      ne recopiait ni `beats` ni `audioUrl`. Les deux corrigés, plus
      `panelsToStepState` qui les rend à la réouverture.

### 2. Générer la voix par temps

- [x] Dans `handleVoiceSelected`, boucler sur `clip.beats` au lieu du clip.
      Le découpage lui-même est un module pur testé,
      `lib/storyboard/narration-jobs.ts` : une image sans temps retombe sur sa
      narration entière, un temps vide ne coûte pas d'appel.
- [x] Appeler `/api/generate-narration` par temps ; la route rend déjà
      `{ url, durationMs }`. Elle accepte maintenant un `beatIndex`, sans quoi
      les fichiers d'une même image étaient indistinguables dans le bac.
- [x] Écrire l'URL et la durée dans le temps correspondant.
- [x] La progression compte les temps, pas les images.
- [x] Un échec ponctuel conserve les temps déjà produits ; un `503` arrête le
      lot (la règle existe déjà, la conserver).
- [x] **Hors plan, mais requis** : la timeline lisait `panel.audioUrl`, un seul
      fichier par image. Sans cela la vidéo perdait sa voix. `panelAudioSegments`
      (`lib/storyboard/audio-segments.ts`) pose un morceau par temps, décalé de
      la somme des durées mesurées qui le précèdent — c'est là que le calage se
      gagne. Un projet enregistré avant le découpage garde son fichier unique.

### 3. Brancher la planification des annotations

- [ ] Après la voix, appeler `/api/plan-annotations` par image, avec
      `beatDurationsMs` tirées des durées mesurées.
- [ ] Écrire le résultat dans `whiteboardConfig.annotations`, en conservant
      celles que l'utilisateur a déjà posées à la main.
- [ ] Relier chaque annotation à son temps (`TranscriptCue.annotationId` existe
      déjà pour ça, aujourd'hui rempli manuellement).
- [ ] Décider où vivent les annotations : `whiteboardConfig.annotations` est
      global, alors que `panel.annotations` est par image. Le rendu lit le
      premier — vérifier avant d'écrire dans le second.

### 4. Vérifier

- [ ] Test de bout en bout sur un script court (2 images, 3 temps).
- [ ] Comparer la somme des durées mesurées à la durée réelle de la vidéo.
- [ ] Vérifier à l'écran qu'une annotation entre bien quand son texte est dit.

---

## Pièges connus

**Vision cadre mal.** `gpt-4o-mini` situe les sujets correctement — bon ordre,
bonnes zones — mais ses rectangles coupent les objets (vérifié en dessinant les
régions sur l'image). Essayer `OPENAI_VISION_MODEL=gpt-4o`, ou demander
explicitement d'englober le sujet entier avec une marge.

**Budget.** Chaque image coûte un appel au moteur, et la génération d'images est
de loin le poste le plus cher. Tester avec un script court : deux images
suffisent à prouver la chaîne. Le TTS et la vision sont négligeables à côté.

**MinIO local.** `S3_PUBLIC_URL` pointe sur `http://localhost:9000`, inaccessible
au moteur de vision : la route `plan-annotations` télécharge donc l'image et
l'envoie encodée. Garder ce détour, il vaut aussi pour un bac privé en production.

**Le disque.** MinIO refuse d'écrire quand la partition est pleine
(`XMinioStorageFull`). C'est arrivé pendant ce chantier.

---

## Hors périmètre

- Placement automatique fin des régions (l'utilisateur ajuste dans l'éditeur).
- Sous-titres à l'export.
- Musique de fond.
