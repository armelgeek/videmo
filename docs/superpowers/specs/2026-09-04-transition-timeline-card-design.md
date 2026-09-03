# Whiteboard — Carte de transition sur la timeline

Date : 2026-09-04
Statut : conception validée, prête pour le plan d'implémentation

## Problème

Le mécanisme de transitions entre clips (`docs/superpowers/specs/2026-09-03-clip-transitions-design.md`)
est implémenté et testé, mais reste sans effet sur les projets réels : les
clips y sont jointifs, donc `transitionAt` ne trouve jamais de blanc où se
loger. Il existe pourtant déjà un geste pour créer ce blanc — tirer le bord
gauche de la première annotation d'un clip déclenche `resize-gap`, qui écrit
`gapBeforeMs` — mais rien ne montre où est ce blanc, ni combien la transition
en occupe.

## Découverte en cours d'exploration : l'écriture de la timeline est cassée

`useAnnotationTimeline` reçoit `globalAnnotations` — la chaîne des annotations
de **tous** les panneaux, préfixées `pN-id` — pour l'affichage. Son propre
commentaire affirme que les écritures, elles, ne portent que sur le panneau
actif. Ce n'est pas ce que fait le code : `edit()` appelle `applyEditorEdit`
directement sur `annotations = globalAnnotations ?? storeAnnotations`, donc sur
la chaîne entière, puis `setAnnotations` remplace tout `animation.annotations`
du store — qui ne représente que le panneau actif — par ce résultat. L'effet de
synchronisation persiste ensuite ce contenu dans le panneau actif via
`storyboard.updatePanel`.

Un test exécuté sur `applyEditorEdit` seul confirme qu'elle preserve
correctement les identifiants et la longueur du tableau qu'on lui donne — le
défaut n'est pas dans cette fonction, il est dans ce que `use-annotation-timeline.ts`
fait de son résultat : n'importe quel geste sur la timeline globale — trim,
`resize-gap`, split, delete, reorder — écrirait aujourd'hui les annotations des
**dix panneaux** dans le panneau actif seul. Ce bug préexiste à cette
fonctionnalité et bloque toute édition sûre depuis la timeline chaînée, pas
seulement le réglage d'une transition.

Le corriger est donc un préalable, pas une extension optionnelle du périmètre.

## Décisions

### 1. Router l'écriture par le préfixe d'identifiant

Chaque annotation de la chaîne globale porte un id `p${panelIdx}-${id local}`,
écrit à sa construction dans `whiteboard-editor-step.tsx`. Le décodage en est
l'inverse exact :

```ts
function panneauDe(id: string): { panelIdx: number; localId: string } | null {
  const m = id.match(/^p(\d+)-(.+)$/);
  return m ? { panelIdx: Number(m[1]), localId: m[2] } : null;
}
```

`edit()` décode le panneau depuis l'id porté par l'édition (présent sur toute
variante de `TimelineEdit` sauf `delete`/`duplicate`, qui portent `ids` — un
tableau, potentiellement multi-panneaux). Pour ces deux cas, `ids` est
partitionné par panneau décodé, et `applyEditorEdit` est appelé **une fois par
groupe**, chaque appel ne recevant que les ids et les annotations locales de ce
panneau ; chaque résultat est ensuite écrit séparément (décision 3) dans le
panneau dont il est issu. Dans tous les cas — édition simple ou groupée —
`applyEditorEdit` ne voit jamais plus que les annotations d'un seul panneau à
la fois.

*Écarté :* changer `activeClipIndex` avant chaque édition, à la manière de la
sélection de clip dans le rail latéral. Plus proche du modèle existant, mais
oblige à re-cliquer avant de trimmer — moins direct pour l'usage visé.

### 2. Frontière entre deux clips : écrire sur le panneau qui suit le blanc

`gapBeforeMs` vit déjà sur la **première** annotation d'un panneau — c'est le
modèle que `deriveTimeline` utilise pour tout le reste du système. Tirer le
bord gauche de cette première annotation écrit donc sur le panneau qui suit le
blanc, sans toucher au panneau précédent. Aucune répartition inter-panneaux à
inventer : une édition ne concerne jamais qu'un seul panneau, celui déduit du
préfixe de l'id édité.

*Écarté :* répartir le calcul entre les deux panneaux selon le bord saisi —
introduirait un concept que le modèle de données actuel ne porte pas.

### 3. Point d'écriture : `updatePanel`, pas systématiquement le store moteur

Le point d'écriture correct est celui que `whiteboard-editor-step.tsx` utilise
déjà pour la persistance : `useStoryboardStore.getState().updatePanel(id, { annotations })`
— import déjà présent dans `use-annotation-timeline.ts`, aucune nouvelle
dépendance. Si le panneau édité est l'actif, on écrit aussi dans le store du
moteur pour que le canvas se redessine immédiatement ; sinon `updatePanel` seul
suffit — pas de re-render du panneau actif pour une édition qui ne le concerne
pas.

### 4. La carte vit dans une couche superposée, pas dans les clips de la `Timeline` NLE

`Timeline` (`@/lib/editor/components/timeline`) est partagée avec l'éditeur
vidéo et rend `view.clips` — un `TimelineClip` par annotation. Le blanc entre
deux clips n'est l'espace d'aucun clip : rien n'y est actuellement rendu, et ce
composant n'a aucune idée du concept « transition whiteboard ». Lui apprendre
cette notion la couplerait à un domaine qui n'est pas le sien.

La carte est donc un composant à part, `ClipTransitionMarkers`, positionné en
absolu par-dessus la timeline, calé sur le même `viewport` (`scrollEl`,
`contentWidth`, `zoomLevel`) que fournit déjà `onViewportChange` — exactement
le patron que `TimelinePlayhead` utilise pour se positionner sans posséder le
code de la timeline qu'il surplombe. Monté à côté de lui et d'`AudioTrackRow`
dans `whiteboard-editor-step.tsx`.

### 5. La poignée règle `durationMs`, jamais `gapBeforeMs`

Glisser le bord droit de la carte modifie la `durationMs` de la transition du
panneau sortant, plafonnée à `[0, blanc]` — la même règle que `transitionAt`
applique déjà à la lecture. `gapBeforeMs` reste réglable par ailleurs, via le
geste de trim existant sur le bord gauche de l'annotation (décision 1) : c'est
ce geste qui *crée* du blanc où loger une transition ; la poignée règle
seulement combien de ce blanc la transition occupe.

*Écarté :* faire glisser la poignée sur `gapBeforeMs` — décalerait la
frontière temporelle du clip suivant et toute la narration en aval, pour un
contrôle qui ne devrait régler qu'une proportion d'un blanc déjà fixé.

*Écarté aussi :* un champ numérique en complément de la poignée. La demande
porte sur voir et régler directement sur la timeline ; dupliquer le contrôle
ajoute une source de vérité pour un gain marginal.

## Modèle de données

Aucun nouveau champ. La carte lit `panel.transition` (type + durée, déjà
introduit par la spec du 2026-09-03) et les frontières déjà calculées comme
`clipWindows` dans `whiteboard-editor-step.tsx`. Elle n'a besoin d'aucun accès
au store d'annotations ni au moteur de rendu.

## Unité isolée et tests

```ts
// lib/whiteboard-animation/timeline/transition-marker-geometry.ts
markerGeometry(
  clips: ClipWindow[],
  pxParMs: number,
): { panelIdx: number; x: number; width: number }[]
```

Traduit une frontière portant une transition en position/largeur pixel,
plafonnée au blanc disponible — même règle que `transitionAt`, dupliquée
volontairement en unité pure pour ne pas faire dépendre le composant du
renderer canvas. Testable sans DOM :

- blanc nul (clips jointifs) ⇒ aucun marqueur ;
- `durationMs` dépassant le blanc ⇒ largeur plafonnée à celle du blanc ;
- transition `'none'` ou absente ⇒ frontière ignorée ;
- plusieurs frontières consécutives ⇒ un marqueur par frontière transitionnée,
  dans l'ordre.

Pour le routage d'écriture (décisions 1-3), un test sur `useAnnotationTimeline`
avec une chaîne à deux panneaux vérifie : un trim sur le panneau 2 ne modifie
pas les annotations du panneau 1 ; le panneau non actif reçoit l'update via
`updatePanel` et non via le store moteur ; le panneau actif reçoit les deux.

Le geste de drag lui-même (pointerdown/move/up) reste non testé, comme tout
geste souris de ce projet — vérification à l'œil.

## Découpage

| | Tâche | Vérifiable par |
| --- | --- | --- |
| 1 | Décodage de panneau + routage d'écriture dans `useAnnotationTimeline` | tests (chaîne à 2 panneaux) |
| 2 | `markerGeometry` + tests | tests |
| 3 | `ClipTransitionMarkers` : rendu des cartes, sans drag | à l'œil |
| 4 | Poignée + geste de drag, commit via `updatePanel` | à l'œil |

Les tâches 1 et 2 sont vérifiables sans navigateur et bloquantes pour tout le
reste : elles portent la seule certitude disponible avant d'attaquer le rendu.

## Hors périmètre

- Le champ numérique de réglage, écarté en décision 5.
- Toute UI pour créer une transition depuis la timeline elle-même — elle se
  crée toujours via le sélecteur déjà construit
  (`clip-transition-picker.tsx`).
- Un geste dédié pour régler `gapBeforeMs` depuis la carte de transition.
