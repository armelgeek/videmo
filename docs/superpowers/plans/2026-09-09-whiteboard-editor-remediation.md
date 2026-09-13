# Plan de Remédiation : Éditeur Vidéo & Normes Whiteboard

> **Statut :** Planification validée  
> **Date :** 2026-09-09  
> **Contexte :** Remise à niveau de l'éditeur vidéo NLE et du moteur d'animation Whiteboard (`lib/editor` et `lib/whiteboard-animation`), traitement des ruptures de normes d'animation et sécurisation de l'export vidéo.

---

## 1. Contexte & Diagnostic des Normes

### 1.1 Normes d'animation Whiteboard non respectées
1. **Découplage Audio / Dessin (Règle d'or de la narration)** :
   - *Norme* : Le dessin doit être asservi au débit de la voix off.
   - *Réalité* : Le moteur d'animation (`animation-engine.ts`) est calé sur une vitesse fixe arbitraire (`FIDELE_1X = 40`). Les réglages de vitesse ont été désactivés et la voix off n'est pas connectée à la cadence du tracé.
2. **Animation de la main & Biomécanique** :
   - *Norme* : L'outil doit s'incliner selon le tracé, et la main doit s'éclipser hors du cadre pendant les pauses de lecture pour ne pas masquer le dessin.
   - *Réalité* : Sprite PNG 2D en translation rigide pure sans rotation, qui reste figé sur le tracé pendant les pauses ou disparaît brusquement.
3. **Mise en scène & Cadrage (Caméra)** :
   - *Norme* : Le tableau blanc nécessite des zooms et panoramiques pour mettre en valeur les éléments dessinés.
   - *Réalité* : Canvas 100% statique. En format 9:16 (vertical/mobile), l'artwork 16:9 est simplement réduit au tiers de l'écran avec 60% de bandes vides.
4. **Fidélité de l'Export (WYSIWYG)** :
   - *Norme* : L'export MP4 doit restituer l'intégralité de la scène visualisée.
   - *Réalité critique* : La boucle de capture d'export dans `editor.tsx` (`drawFrameToCanvas`) ne capture **que** les vidéos de fond et les textes : **le calque Whiteboard (tracés et mains) est totalement exclu de l'export MP4**.

### 1.2 Dette technique & Fragilités de l'Éditeur
1. **Monolithe `editor.tsx` (1 770 lignes)** :
   - Mélange le mixage Web Audio, la boucle d'encodage FFmpeg, les raccourcis et le rendu direct.
   - Plus de 50 props injectées manuellement dans `Timeline`.
2. **Export FFmpeg WASM à risque d'OOM** :
   - Écriture de milliers de fichiers individuels `frame%04d.jpg` dans la mémoire virtuelle WASM (`MEMFS`), risquant un crash mémoire au-delà de 2 minutes de vidéo.
   - Seeks bloquants sur éléments `<video>` du DOM ralentissant l'export de façon critique.
3. **Contrôles fantômes dans l'UI** :
   - `inkplainer-sidebar.tsx` expose encore `revealSpeed`, `handSpeed`, `chunks`, `resolution` et `useAnnotation` alors qu'ils sont ignorés par le moteur.
4. **Dimensions figées dans le Player** :
   - `preview-player.tsx` force le canvas Whiteboard à 1920×1080 sans suivre le ratio du projet.

---

## 2. Découpage par Phases de Remédiation

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1 : Socle Critique & Fiabilité (Immédiat)            │
│ 1. Intégration du Whiteboard dans l'export MP4 (FFmpeg)     │
│ 2. Adaptation dynamique des ratios dans le PreviewPlayer    │
│ 3. Retrait / masquage de la main pendant les pauses         │
│ 4. Nettoyage des contrôles orphelins dans la sidebar        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2 : Synchronisation Audio & Cadrage (Moyen terme)     │
│ 1. Asservissement durée tracé sur clips audio narration     │
│ 2. Cadrage adaptatif / Focus région pour format portrait 9:16│
│ 3. Découpage modulaire de editor.tsx (mixeur audio/export)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3 : Effets Avancés & Optimisation Export (Évolution) │
│ 1. Transitions d'effacement tableau (éponge / hand-swipe)   │
│ 2. Pipeline d'export via stream/WebCodecs (zéro fichier jpg)│
│ 3. Rotation et dynamique réaliste de la main                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Feuille de Route Détaillée — Phase 1

### Tâche 1.1 : Intégration des calques Whiteboard dans l'export MP4
- **Fichiers cibles :**
  - `lib/editor/hooks/use-playback.ts`
  - `lib/editor/components/editor.tsx`
- **Objectif :**
  - Permettre à `drawFrameToCanvas(ctx, width, height, time)` de dessiner le contenu du canvas Whiteboard (`whiteboardCanvasRef`) ainsi que la main animée (`whiteboardHandCanvasRef`) à la position temporelle `time`.
  - Dans la boucle d'export de `editor.tsx`, synchroniser le moteur Whiteboard sur le temps courant (`exportTime`) avant chaque capture de frame.
- **Étapes :**
  - [ ] Passer les refs des canvas Whiteboard (`whiteboardCanvasRef`, `whiteboardHandCanvasRef`) à `usePlayback`.
  - [ ] Dans `drawFrameToCanvas`, superposer ces canvas au-dessus de l'image vidéo de fond et sous les overlays texte.
  - [ ] Assurer la mise à jour synchrone du moteur Whiteboard (`repositionTo(exportTime)`) dans la boucle d'export.
- **Vérification :**
  - Lancer un export vidéo d'un projet avec Whiteboard et vérifier que le MP4 généré affiche les tracés et la main.

### Tâche 1.2 : Ratios d'aspect dynamiques dans le PreviewPlayer
- **Fichiers cibles :**
  - `lib/editor/components/editor.tsx`
  - `lib/editor/components/preview-player.tsx`
- **Objectif :**
  - Éliminer les dimensions en dur `1920x1080` passées à `useWhiteboardRenderer` et au lecteur.
- **Étapes :**
  - [ ] Calculer `canvasWidth` et `canvasHeight` à partir de `videoConfig.aspectRatio` (ex: 1920×1080 pour 16:9, 1080×1920 pour 9:16, 1080×1080 pour 1:1).
  - [ ] Injecter ces dimensions dans `useWhiteboardRenderer` et dans les balises canvas de `preview-player.tsx`.
- **Vérification :**
  - Basculer le projet en 9:16 ; vérifier que le canvas du lecteur s'adapte sans déformation d'artwork.

### Tâche 1.3 : Éclipse / Masquage de la main pendant les temps de pause
- **Fichiers cibles :**
  - `lib/whiteboard-animation/hooks/use-whiteboard-renderer.ts`
  - `lib/whiteboard-animation/services/whiteboard-editor-service.ts`
- **Objectif :**
  - Lorsque la tête de lecture se situe sur un intervalle d'attente (`gapBeforeMs`), après la fin d'une région ou en pause, la main ne doit pas rester statique sur le dessin.
- **Étapes :**
  - [ ] Détecter si la position temporelle actuelle correspond à une phase active de dessin d'une région ou à une zone neutre/pause.
  - [ ] Si neutre : effacer le canvas de la main (`handCtx.clearRect`) ou animer sa sortie hors de la zone utile.
- **Vérification :**
  - Jouer une scène avec un gap ; vérifier que la main disparaît dès la fin du tracé et réapparaît au début du tracé suivant.

### Tâche 1.4 : Nettoyage des réglages orphelins dans la Sidebar
- **Fichiers cibles :**
  - `lib/whiteboard-animation/components/inkplainer-sidebar.tsx`
- **Objectif :**
  - Supprimer les champs qui n'ont aucun effet dans le moteur (`revealSpeed`, `handSpeed`, `chunks`, `resolution`, `useAnnotation`).
- **Étapes :**
  - [ ] Retirer les sliders et sélecteurs correspondants du JSX.
  - [ ] Nettoyer les bindings inutilisés pour ne laisser que le style d'animation, la couleur d'arrière-plan et le choix de la main.
- **Vérification :**
  - Ouvrir la sidebar Whiteboard et vérifier que tous les contrôles restants sont effectifs.

---

## 4. Feuille de Route — Phase 2 & Phase 3 (Rappel synthétique)

### Phase 2 : Narration & Cadrage
- **2.1 Liaison Narration-Tracé** : Asservir la durée de révélation d'une annotation sur la durée audio du panneau de storyboard correspondant.
- **2.2 Cadrage Vertical (9:16)** : Implémenter un mode zoom/focus sur le rectangle de région active pour remplir l'écran en portrait.
- **2.3 Découpage d'editor.tsx** : Extraire `useAudioMixer` et `useExportOrchestrator` pour ramener le composant sous les 600 lignes.

### Phase 3 : Rendu Avancé & Robustesse
- **3.1 Effacements Whiteboard** : Implémenter des transitions spécifiques (main éponge / balayage).
- **3.2 Pipeline Export Dédié** : Remplacer l'écriture disque de milliers de JPEGs par un encodage flux WebCodecs ou pipe raw YUV.
- **3.3 Inclinaison Réaliste de la Main** : Calculer la dérivée du vecteur de déplacement pour orienter l'angle du stylet.

---

## 5. Critères de Réussite Globaux

| Test / Scénario | Résultat Attendu |
|---|---|
| **Export MP4 avec Whiteboard** | La vidéo exportée contient les tracés et la main animée. |
| **Changement de ratio 16:9 ↔ 9:16** | Le canvas de prévisualisation et d'export s'adapte sans écrasement. |
| **Lecture avec temps morts** | La main s'éclipse pendant les pauses, le texte reste parfaitement lisible. |
| **Cohérence UI Sidebar** | 100% des curseurs affichés ont un effet observable à l'écran. |
| **Tests de régression** | L'ensemble des 264 tests Vitest existants reste vert. |
