# Whiteboard — Transitions entre clips

Date : 2026-09-03
Statut : conception validée, prête pour le plan d'implémentation

## Problème

Le passage d'un clip à l'autre est une coupe franche. L'horloge franchit une
frontière, `activeClipIndex` bascule, la nouvelle illustration se charge et se
trace. Rien n'adoucit le raccord.

Les briques pour le faire existent pourtant déjà — mais orphelines.

## État des lieux

`lib/whiteboard-animation/lib/transitions.js` contient six transitions
(`cut`, `fade`, `slideup`, `slidedown`, `slideleft`, `slideright`), un résolveur
`resoudreTransition` avec repli sur `fade`, et `nomsTransitions` pour l'interface.
Chaque transition est une fonction de dessin :

```js
(ctx, sortante, entrante, t, W, H)   // t de 0 (sortante) à 1 (entrante)
```

Son seul consommateur est `test-animations.js`, un script. Le renderer React ne
l'importe jamais.

`project.js` porte en outre un modèle d'ordonnancement — `transition:
{ transitionAfter, transitionMs }` par scène, planifié en `curseur = endMs +
transitionMs` — lui aussi inutilisé par l'application.

Deux constats de terrain conditionnent la conception :

1. **Duplication intégrale.** `lib/whiteboard-animation/*.js` et
   `lib/whiteboard-animation/lib/*.js` comptent 14 fichiers chacun, mêmes noms,
   `transitions.js` identique à l'octet. Le renderer charge `'../lib/index'`,
   donc seule la copie `lib/` est vivante.
2. **Les blancs sont courts.** `deriveTimeline` chaîne les annotations en
   `startMs = cursor + gapBeforeMs`. L'écart entre deux clips vaut donc le blanc
   de tête du clip entrant. Dans les données de départ il est de **300 ms**,
   alors que le contenu déjà écrit demande `transitionMs: 2300`.

Ce second point révèle un conflit de modèles : les fichiers de scène ont été
écrits pour une narration **par scène** (`sceneDurationMs`, transition en fin de
scène), alors que l'application utilise désormais une narration **continue**
dont les timestamps pilotent tout le dessin.

## Décisions

### 1. La transition se loge dans le blanc existant, plafonnée à sa durée

Durée effective : `d = min(durationMs configuré, B.startMs − A.endMs)`.

La durée totale de la vidéo est donc inchangée **par construction**, et la
narration ne dérive jamais. Aucun arbitrage entre rogner A ou retarder B.

Conséquence assumée : avec les données actuelles les transitions durent ~300 ms,
et le `transitionMs: 2300` des fichiers est plafonné, non honoré. Le levier pour
obtenir une transition plus longue est d'allonger le `gapBeforeMs` de la première
annotation du clip entrant.

*Écarté :* le modèle de `project.js`, qui donne à la transition son propre
créneau et allonge la vidéo — il décale le dessin par rapport à la narration
continue. Écarté aussi : déborder sur la fin du clip sortant, qui le ferait
partir avant d'avoir fini de se tracer.

### 2. On fond le clip sortant vers le fond, pas vers le clip entrant

Pendant le blanc, A a fini de tracer et B n'a rien à montrer. Le côté `entrante`
n'est donc pas B mais un canvas rempli par `paintBackground` :

| argument | source |
| --- | --- |
| `sortante` | dernière image de A, figée |
| `entrante` | canvas rempli par `paintBackground` |

La transition lit « A s'en va ». Pour `fade`, A s'estompe vers le fond ; pour
`slideup`, A sort par le haut et le fond entre derrière. Cohérent pour les six.

Un seul moteur est actif à tout instant — il n'y a jamais deux illustrations en
mémoire.

*Écarté :* faire tourner les deux moteurs en recouvrement (plus vivant, mais
coûteux), et pré-calculer le dessin fini de B (qui supprimerait son animation).

### 3. Le rendu est une étape de post-composition

Le dessin normal est composé comme aujourd'hui ; si l'instant tombe dans une
fenêtre de transition, on applique par-dessus :

```js
resoudreTransition(nom)(ctx, instantané, fond, t, W, H)
```

Deux points d'insertion, les deux qui peignent déjà :

- la boucle rAF, pour la lecture ;
- `repositionTo`, pour le scrub — sans quoi traverser la frontière au curseur
  ne montrerait rien.

**L'instantané.** En lecture, on copie le canvas visible au premier passage à
`A.endMs`. Au scrub, `repositionTo` rejoue déjà depuis zéro à chaque seek : une
position dans le blanc rejoue A jusqu'à la fin de son tracé, ce qui *est* l'état
recherché. Aucun mécanisme supplémentaire.

**Pourquoi c'est sûr.** Pendant le blanc, `panelBoundaries.find(b => t >=
b.startMs && t < b.endMs)` ne trouve aucun clip, donc `activeClipIndex` reste sur
A et son illustration est encore chargée.

## Modèle de données

Un champ par clip sur le panneau storyboard :

```ts
type TransitionName = 'none' | 'cut' | 'fade' | 'slideup' | 'slidedown'
                    | 'slideleft' | 'slideright';

interface Transition {
  type: TransitionName;
  durationMs: number;
}
```

Le panneau storyboard porte alors un champ `transition?: Transition`. Les noms
sont ceux de `nomsTransitions()`, plus `'none'`. Champ absent ou type `'none'`
vaut coupe franche : **les projets existants gardent leur comportement**.

## Interface du hook

Le renderer ne connaît qu'un scalaire, `clipOffsetMs`. Il lui faut en plus les
frontières et la configuration :

```ts
clips?: { startMs: number; endMs: number; transition?: Transition }[]
```

`clipOffsetMs` **subsiste inchangé** : il désigne le clip actif et sert à passer
de l'horloge globale à l'horloge locale du moteur. `clips` est purement additif
et décrit la séquence entière.

Le composant calcule déjà `panelBoundaries` ; il suffit d'y joindre le champ
`transition` du panneau correspondant.

## Unité isolée et tests

Toute la correction du dispositif tient dans une fonction pure, sans canvas :

```ts
// lib/whiteboard-animation/timeline/clip-transitions.ts
transitionAt(clips, globalMs): { name: string; t: number } | null
```

Elle trouve la paire dont le blanc contient `globalMs`, calcule `d`, et renvoie
`t = (globalMs − A.endMs) / d`. Le plafonnement et les bornes vivent là — donc
les tests aussi. Le renderer garde un rôle bête : prendre l'instantané, appeler
la primitive.

Cas couverts, en TDD sur la suite vitest existante :

- plafonnement quand `durationMs` dépasse le blanc disponible ;
- `t` valant 0 au tout début de la fenêtre, proche de 1 à sa fin ;
- `null` pour `'none'`, pour un blanc nul, et après le dernier clip ;
- repli sur `fade` pour un nom inconnu (`resoudreTransition`, déjà écrit).

Le dessin lui-même reste non testé, comme tout le rendu canvas de ce projet.

## Découpage

| | Étape | Vérifiable par |
| --- | --- | --- |
| 1 | `clip-transitions.ts` + tests — aucun changement de comportement | tests |
| 2 | Champ `transition` sur le panneau storyboard | `tsc` |
| 3 | Renderer : prop `clips`, post-composition dans la boucle rAF | à l'œil, en lecture |
| 4 | Idem dans `repositionTo` | à l'œil, au scrub |
| 5 | UI : choix de la transition par clip | à l'œil |

Les étapes 1 et 2 ne changent rien de visible ; le comportement apparaît à
l'étape 3. Deux points d'arrêt sûrs.

## Hors périmètre

- **Le duplicat.** On importe depuis `lib/whiteboard-animation/lib/`, la copie
  que le renderer charge déjà ; l'autre n'est pas touchée. Sa suppression est une
  décision séparée.
- **Les transitions de l'éditeur vidéo** (`transitions-panel.tsx`,
  `use-playback.ts`) portent sur les clips FFmpeg et restent inchangées.
- **Les blancs réglables à l'édition**, qui permettraient des transitions plus
  longues, sont reportés.

## Point laissé ouvert

Au repos dans un blanc, en mode Édition, faut-il continuer d'afficher les cadres
d'annotation de A par-dessus un dessin à moitié effacé ? Les laisser est le plus
simple ; les masquer serait plus propre visuellement mais empêcherait d'éditer à
cet instant. Sans effet sur le reste de la conception : à trancher à l'usage.
