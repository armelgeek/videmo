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

- [x] Après la voix, appeler `/api/plan-annotations` par image. Les durées
      mesurées n'ont pas eu besoin d'un champ de requête : elles voyagent dans
      la scène, portées par ses temps depuis la synthèse. Une image qui échoue
      laisse les autres passer.
- [x] Écrire le résultat, en conservant celles que l'utilisateur a posées à la
      main. `adoptPlannedAnnotations` (`lib/storyboard/annotation-adoption.ts`)
      les reconnaît à `metadata.source`, et donne aux siennes un identifiant
      stable pour qu'une seconde passe remplace au lieu de dupliquer.
- [x] Relier chaque annotation à son temps : `transcriptFromPanels` produit les
      cues avec leur `annotationId` déjà rempli.
- [x] **Décider où vivent les annotations.** Le plan supposait le contraire de
      ce que fait le code : `to-render-project.ts:79` et
      `whiteboard-editor-step.tsx:227` lisent **`panel.annotations` en premier**,
      `whiteboardConfig.annotations` n'étant qu'un repli — donc le même dessin
      pour toutes les images. C'est donc par image que la planification écrit.

**Un piège de repère, trouvé en chemin.** La vision répond en pixels de
l'image ; les annotations enregistrées sont en pixels du canvas d'aperçu, où le
dessin tient centré sans déformation (`rectContenu`). Écrire les unes pour les
autres plaçait le stylo à côté du sujet dès que le ratio du projet ne suivait
pas celui de l'image. `adoptPlannedAnnotations` fait la reprojection, et
`measureImageSize` mesure l'image plutôt que de supposer un format.

**Ce que l'ordre du tableau décide.** `deriveTimeline` recalcule `startMs`
depuis l'ordre et les durées : `reveal.startMs` en entrée est ignoré. Une
annotation dessinée à la main est donc conservée *après* les temps de
narration — elle rallonge la scène au lieu de décaler la voix de ceux qui la
précèdent.

### 4. Vérifier

- [x] Test de bout en bout sur un script court (2 images, 3 temps), contre les
      vrais services : gpt-image-1, TTS, ffprobe, MinIO, vision.
- [x] Comparer la somme des durées mesurées au calage produit. **Écart : 0 ms.**
      Le transcript sort à 0–5160, 5160–6912, 6912–11928 ms, et la somme des
      trois audios mesurés vaut exactement 11928 ms : chaque annotation entre
      quand son temps commence.
- [x] Vérifier à l'écran. Fait sur les régions rendues, dessinées sur les
      illustrations elles-mêmes (le rendu vidéo complet reste à faire dans
      l'éditeur).

**La dérive mesurée, sur ce script :**

| | Estimé | Mesuré | Écart |
|---|---|---|---|
| Image 0, temps 0 | 3300 ms | 5160 ms | +1860 |
| Image 0, temps 1 | 1300 ms | 1752 ms | +452 |
| Image 1, temps 0 | 4300 ms | 5016 ms | +716 |
| **Total** | **8900 ms** | **11928 ms** | **+3028** |

Trois secondes de décalage sur onze secondes de film — la dérive est réelle, et
c'est bien elle que le découpage par temps supprime.

**Le piège de la vision, mesuré puis corrigé.** `gpt-4o-mini` ne cadrait pas :
il rendait un carré de 50×50 au milieu d'une tasse qui occupe 900 pixels, soit
2 % de l'image, et plaçait le temps « la chaleur le réveille » sur le bord du
grain plutôt que sur la flamme. Les deux pistes notées ici ont été essayées sur
les mêmes images :

| | Rectangle du sujet principal |
|---|---|
| consigne d'origine, `gpt-4o-mini` | 2 % à 5 % de l'image |
| consigne resserrée, `gpt-4o-mini` | 5 % à 7 % |
| consigne resserrée, `gpt-4o` | **19 % à 36 %, autour du sujet** |

Les deux sont donc adoptées : la consigne exige d'englober le sujet entier avec
une marge et donne une taille plancher, et `gpt-4o` devient le modèle par
défaut. Vérifié à l'œil : le grain et la tasse sont désormais entourés.

### 5. Cadrer par l'encre, non par le modèle

Le rectangle restait imprécis même avec `gpt-4o` : la flamme n'était attrapée
que par son bord. La cause est en amont — on demandait à un modèle de langage de
**produire des coordonnées**, ce qu'il fait mal par nature.

Or sur un dessin à l'encre noire, les bornes exactes sont dans l'image. On les
mesure : `inkRegions` (`lib/image/ink-regions.ts`) regroupe l'encre en sujets
par une grille grossière et rend le rectangle de chacun, au pixel. Le modèle ne
sert plus qu'à **désigner** lequel — `snapToInk` ramène son rectangle deviné sur
le sujet qu'il recouvre le plus.

- [x] `inkRegions` : regroupement de l'encre, tests sur pages synthétiques.
- [x] `snapToInk` : appariement par surface commune, repli sur le sujet le plus
      proche quand le modèle a visé le papier vide, et passe-plat quand aucun
      sujet n'a été mesuré.
- [x] `measureInkCandidates` mesure dans le navigateur, par canvas : le serveur
      n'a aucun décodeur d'image, et la contrainte « aucune nouvelle dépendance »
      tient.
- [x] La route accepte ces candidats, facultatifs : sans eux, le comportement
      d'avant.

**Vérifié sur les mêmes illustrations :**

| Temps | Deviné par gpt-4o | Aimanté sur l'encre |
|---|---|---|
| le grain | 350,200 550×650 | **309,201 426×574** |
| la flamme | 900,350 300×450 | **1011,361 210×330** |
| la tasse | 460,275 640×475 | **449,100 669×760** |

La flamme — le cas qui restait faux, décalé de deux cents pixels — tombe
maintenant juste. Vérifié à l'œil : chaque sujet est encadré au trait près.

**Ce qui reste.** La méthode suppose un dessin sombre sur fond clair : c'est ce
que produit ce moteur de whiteboard, mais une illustration en aplats de couleur
rendrait un seul sujet couvrant tout. Le repli tient (une zone trop large plutôt
que rien), et l'utilisateur ajuste dans l'éditeur.

---

## Pièges connus

**Vision cadre mal.** ~~Essayer `OPENAI_VISION_MODEL=gpt-4o`, ou demander
explicitement d'englober le sujet entier avec une marge.~~ **Fait, tâche 4 :**
les deux à la fois. `gpt-4o` est le défaut, la consigne porte une taille
plancher. Le second sujet d'une image reste approximatif.

**Budget.** Chaque image coûte un appel au moteur, et la génération d'images est
de loin le poste le plus cher. Tester avec un script court : deux images
suffisent à prouver la chaîne. Le TTS et la vision sont négligeables à côté.

**MinIO local.** `S3_PUBLIC_URL` pointe sur `http://localhost:9000`, inaccessible
au moteur de vision : la route `plan-annotations` télécharge donc l'image et
l'envoie encodée. Garder ce détour, il vaut aussi pour un bac privé en production.

**Le disque.** MinIO refuse d'écrire quand la partition est pleine
(`XMinioStorageFull`). C'est arrivé pendant ce chantier. La partition était à
97 % lors de la vérification, sans incident — mais la marge est mince.

**Le réseau, depuis un script.** Un `fetch` Node vers `api.openai.com` a échoué
en `ETIMEDOUT` sur deux lancements, là où `curl` passait dans la seconde. Le
même script relancé sans rien changer passe. À relancer plutôt qu'à déboguer.

---

## Hors périmètre

- Placement automatique fin des régions (l'utilisateur ajuste dans l'éditeur).
- Sous-titres à l'export.
- Musique de fond.
