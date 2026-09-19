# Whiteboard — Style SkeletonTrace & Résolution de Jonctions (R1 + R2)

Date : 2026-09-19  
Statut : Conception validée, en attente de revue utilisateur avant plan d'implémentation

---

## 1. Contexte & Problème

Dans le moteur d'animation whiteboard actuel (`lib/whiteboard-animation/`), les styles de dessin existants (`Contour`, `ChunkJump`, `Scanner`, `OutlineChunks`) révèlent les illustrations par balayage spatial (bandes horizontales, tuiles géométriques, sweeps directionnels ou détection de bords). Visuellement, cela produit un effet de **"dévoilement"** (wipe / unmasking) plutôt qu'un véritable **"dessin tracé à la main"**.

La référence Python (`whiteboard-animator/whiteboard_animator/`) résout ce problème par une approche topologique :
1. **R1 (Skeleton Tracing)** : Amincissement morphologique pour extraire l'axe médian (squelette 1-pixel) et parcours le long de cet axe comme le ferait un feutre.
2. **R2 (Junction Resolution)** : Reconnexion des branches aux carrefours (croisements en croix "+", jonctions en "T", bifurcations) par continuité de tangente (produit scalaire le plus opposé / cosinus proche de -1), évitant l'effet d'étoile ou d'explosion centrifuge.

### Différence de paradigme
* **Référence Python** : Génère une matrice globale `timing_map: Float32Array[H, W]` de timestamps pré-calculés, décodée ensuite hors-ligne.
* **Moteur Web JS** : Moteur interactif temps-réel cadencé par trame (`setup()` + `tick()` + `paceStep()`) opérant sur des contextes Canvas HTML5 à 60 FPS, avec gestion des régions et annotations (`AnnotationManager`).

---

## 2. Objectif

Créer un nouveau style d'animation **`SkeletonTrace`** (`skeletontrace`), nativement intégré dans l'architecture `Animation` existante :
* Décomposition topologique en traits continus orientés.
* Résolution des bifurcations par appariement de continuité angulaire (R2).
* Révélation progressive fidèle à l'épaisseur locale du trait via une carte de distance adaptative.
* Rendu interactif 60 FPS avec suivi fluide de la main au bout de la plume.
* 100% en pur TypeScript / JavaScript, zéro dépendance native ou binaire externe.

### Hors périmètre
* Re-classification sémantique deep learning (CRAFT / ONNX text detection) — le style s'applique sur les régions et contours détectés par le moteur existant.
* Styles de hachures / remplissage de zones intérieures complexes (relevant de `BrushFill` / `IllustFill`).

---

## 3. Architecture & Découpage Modulaire

Pour garantir une isolation totale et une testabilité unitaire sans environnement DOM/Canvas, la logique algorithmique est découplée dans un sous-dossier dédié `lib/whiteboard-animation/lib/skeleton/` :

```
lib/whiteboard-animation/
├── lib/
│   ├── skeleton/
│   │   ├── thinning.js             # Amincissement Zhang-Suen 2-passes (Uint8Array)
│   │   ├── distance-transform.js   # Carte de distance 2-passes (Chamfer 3-4)
│   │   ├── skeleton-graph.js       # Degrés 8-voisins, clustering BFS des jonctions, parcours d'arêtes
│   │   └── junction-resolver.js    # Calcul des tangentes, cosinus, appariement et assemblage
│   └── styles/
│       ├── SkeletonTrace.js        # Classe Animation (setup, tick, paceStep, canvas reveal)
│       └── index.js                # Enregistrement du style
├── types.ts                        # Ajout de "skeletontrace" au type AnimationStyle
└── AnimationFactory.ts             # Typage factory
```

### Contrat des modules
* **`thinning.js`** : `thinZhangSuen(mask: Uint8Array, width: number, height: number): Uint8Array`
  Prend le masque binaire de la région et produit un squelette connexe d'1 pixel d'épaisseur.
* **`distance-transform.js`** : `distanceTransformChamfer(mask: Uint8Array, width: number, height: number): Float32Array`
  Calcule la distance de chaque pixel au bord extérieur le plus proche pour obtenir le rayon local $r(x, y)$.
* **`skeleton-graph.js`** : `extractSkeletonPaths(skeleton: Uint8Array, width: number, height: number): SkeletonPath[]`
  Identifie les nœuds ($\text{degré} \neq 2$), groupe les carrefours adjacents via BFS, et extrait les chaînes de pixels régulières entre nœuds.
* **`junction-resolver.js`** : `buildLineArtStrokes(paths: SkeletonPath[], distMap: Float32Array, width: number): Stroke[]`
  Apparie les branches incidentes aux carrefours par minimisation du produit scalaire des tangentes et assemble les traits séquentiels complets avec leurs waypoints `{ x, y, r }`.
* **`SkeletonTrace.js`** : Implémente `setup()` et `tick()` en orchestrant les modules ci-dessus et en animant la main sur `hctx`.

---

## 4. Algorithmes Détaillés

### 4.1. Amincissement Zhang-Suen (`thinning.js`)
L'algorithme itère sur deux sous-passes jusqu'à ce qu'aucun pixel ne soit supprimé :
* Considère les 8 voisins $P_2, P_3, \dots, P_9$ dans le sens horaire autour de $P_1$.
* $B(P_1)$ : nombre de voisins non nuls ($2 \le B(P_1) \le 6$).
* $A(P_1)$ : nombre de transitions $0 \to 1$ dans la suite ordonnée circulaire ($A(P_1) = 1$).
* **Sous-passe 1** : Condition $P_2 \cdot P_4 \cdot P_6 = 0$ et $P_4 \cdot P_6 \cdot P_8 = 0$.
* **Sous-passe 2** : Condition $P_2 \cdot P_4 \cdot P_8 = 0$ et $P_2 \cdot P_6 \cdot P_8 = 0$.

### 4.2. Rayon local adaptatif (`distance-transform.js`)
Distance Transform Chamfer 3-4 en deux balayages séquentiels :
* Passe avant (Nord-Ouest vers Sud-Est) : propagation avec poids 3 (orthogonal) et 4 (diagonal).
* Passe arrière (Sud-Est vers Nord-Ouest) : rétro-propagation minimale.
* Pour chaque pixel du squelette, le rayon équivalent est $r(x, y) = \text{distance} / 3$.

### 4.3. Topologie & Clustering de Nœuds (`skeleton-graph.js`)
* Calcul du degré 8-voisins pour chaque pixel actif du squelette :
  * $\text{degré} = 1$ : extrémité de trait (`endpoint`).
  * $\text{degré} = 2$ : corps de trait régulier.
  * $\text{degré} \ge 3$ : bifurcation / carrefour (`junction`).
* **Clustering BFS** : les pixels de carrefour adjacents sont fusionnés en une composante connexe représentant un nœud unique, avec calcul de son barycentre $(\bar{x}, \bar{y})$.
* **Parcours d'arêtes** : depuis chaque nœud, exploration des voisins $\text{deg} = 2$ jusqu'à atteindre le nœud opposé.

### 4.4. Résolution de Jonctions R2 (`junction-resolver.js`)
* Pour chaque arête incidente à un nœud de carrefour :
  * Calcul du vecteur directeur unitaire sortant $\vec{d}$ avec un lookahead de 5 pixels :
    $$\vec{v} = P_{\min(5, L-1)} - P_0, \quad \vec{d} = \frac{\vec{v}}{\|\vec{v}\|}$$
* Pour toutes les paires d'arêtes $(A, B)$ arrivant au même carrefour :
  * Calcul du cosinus $\cos(\theta) = \vec{d}_A \cdot \vec{d}_B$.
* **Appariement glouton** : tri par cosinus croissant (les branches à $\sim 180^\circ$, où $\cos \approx -1$, sont appariées en priorité).
* **Assemblage** :
  1. Départ aux terminaisons naturelles (`endpoint`) ou branches orphelines.
  2. Suivi de l'arête courante et franchissement direct du carrefour via sa branche appariée.
  3. Gestion des cycles purs (boucles fermées sans carrefour ni terminaison) avec départ au point le plus au nord-ouest.

---

## 5. Rendu & Intégration Moteur (`SkeletonTrace.js`)

### Cycle de vie dans `Animation`
1. **`setup()`** :
   * Récupère `this.state.contentBounds` et la `presenceMap`.
   * Exécute la chaîne `thinning` $\to$ `distanceTransform` $\to$ `skeletonGraph` $\to$ `junctionResolver`.
   * Prépare la liste plate ordonnée de waypoints `{ x, y, r, isNewStroke }`.
   * Initialise un canvas masque hors-champ `revealMaskCanvas` transparent.
2. **`tick(speed, deltaMs)`** :
   * Appelé dans `this.withAnnotationAwareness(deltaMs, ...)`.
   * Consomme $N$ waypoints via `this.paceStep(remainingPts, handSpeed, ...)`.
   * Révèle les portions de trait sur `revealMaskCanvas` en reliant $P_{i-1}$ à $P_i$ par des segments `lineCap = 'round'` de largeur $2 \times r_i$.
   * Si $P_i$ débute un nouveau trait (`isNewStroke = true`), la main effectue une transition rapide interpolée (stylo levé).
   * Composite le dessin sur `this.ctx` : l'image originale `this.offscreen` masquée par `revealMaskCanvas`.
   * Positionne la main sur `this.hctx` avec orientation dynamique ($\Delta x$).
   * Déclenche `this.finishAnim()` à l'épuisement des waypoints.

---

## 6. Scénarios & Cas Limites

| Cas | Comportement attendu |
|---|---|
| **Croix / Plus (+)** | Trait horizontal tracé d'un bout à l'autre, puis trait vertical tracé d'un bout à l'autre (2 traits continus, aucune fragmentation en 4). |
| **Jonction en T** | Barre horizontale tracée en continu, puis pied du T tracé comme trait distinct. |
| **Cercle / Forme fermée** | Parcours du périmètre en 1 seul trait continu à partir du sommet supérieur gauche. |
| **Trait simple droit** | 1 seul trait de l'extrémité A à l'extrémité B. |
| **Région vide (0 px)** | Fin immédiate sans erreur (`finishAnim()`). |
| **Pixels isolés de bruit** | Écartés dès la phase d'extraction (taille $< 2$). |

---

## 7. Critères d'Acceptation (AC)

* **AC-1 : Continuité au croisement (R2)**  
  **Given** une image contenant des intersections de traits (croix, quadrillage).  
  **When** le style `SkeletonTrace` s'exécute.  
  **Then** chaque ligne est dessinée en un trait continu d'un bout à l'autre à travers le carrefour.

* **AC-2 : Fidélité du rayon local (Reveal)**  
  **Given** un dessin avec des traits fins (2px) et des traits épais (12px).  
  **When** la main parcourt le tracé.  
  **Then** les traits épais sont entièrement dévoilés sans trous et les traits fins ne bavent pas sur les zones avoisinantes.

* **AC-3 : Robustesse aux cas limites**  
  **Given** une région vide ou du bruit isolé.  
  **When** `setup()` et `tick()` sont appelés.  
  **Then** aucune exception n'est levée et l'animation se termine proprement.

* **AC-4 : Fluidité 60 FPS & Suivi de la main**  
  **Given** une animation en lecture.  
  **When** les trames défilent.  
  **Then** la main reste calée exactement sur la pointe du tracé en cours, avec orientation correcte.

---

## 8. Stratégie de Vérification

* **Tests unitaires algorithmiques (Jest / Node)** :
  * `thinning.test.js` : test de convergence et connectivité sur matrices binaires synthétiques.
  * `distance-transform.test.js` : vérification des distances Chamfer sur des barres de largeurs calibrées.
  * `skeleton-graph.test.js` : comptage de degrés et clustering de nœuds sur croix 2D.
  * `junction-resolver.test.js` : validation de l'appariement à $180^\circ$ (cosinus $\sim -1$) et du non-éclatement des carrefours.
* **Test de non-régression du moteur** :
  * Instanciation via `AnimationFactory.create('skeletontrace', ...)`.
  * Exécution complète de `setup()` et simulation de `tick()` jusqu'à `finishAnim()`.
