# Whiteboard Editor - Vérifications Manquantes

Section 6 du WHITEBOARD_EDITOR_TODO.md. État des tests et vérifications du moteur d'annotations.

## ✅ Vérifications Complétées

- **Formats non-16:9 (état au repos)** - Artwork centré correctement, cadres alignés, pas de déformation
- **Dimensionnement et reprojection** - 12 tests couvrent aller-retour sans dérive, cas dégénérés
- **Styles smoke test** - 13 styles traversent une timeline annotée sans crash (`styles-smoke.test.ts`)
- **Performance seek** - Régression de 42–143ms à 14–34ms mesurée

---

## ❌ Vérifications Manquantes

### 1. Lecture en portrait (9:16) non confirmée

**Détail:** L'état au repos est vérifié (artwork centré, cadres alignés) mais l'animation elle-même n'a pas été vue tourner en 9:16.

**Blocker:** Extension navigateur déconnectée avant de pouvoir tester la lecture complète.

**À faire:**
```bash
# 1. Relancer la dev app en mode portrait
npm run dev

# 2. Naviguer vers Whiteboard editor
# 3. Changer aspect ratio à 9:16 en haut
# 4. Générer une animation simple
# 5. Observer que:
#    - L'artwork est centré (pas étirée)
#    - Les annotations sont visibles dans leurs régions
#    - La lecture progresse correctement (~2-3 secondes)
```

**Assertion:** Créer un test e2e qui capture une vidéo en 9:16 et vérifie les dimensions du canvas.

---

### 2. Six styles ajoutés au menu jamais vus à l'écran

**Styles ajoutés (6):**
- `outlinechunks`
- `outlinefill`
- `outlineonly`
- `spec-text`
- `specialized`
- `topanchor`

**État actuel:**
- ✅ Couverts par `styles-smoke.test.ts` (traversent une timeline sans crash)
- ❌ Rendu visuel jamais inspecté

**À faire:**
```bash
# Pour chaque style:
# 1. npm run dev
# 2. Sélectionner le style dans le dropdown
# 3. Générer une annotation simple
# 4. Observer le rendu (pas de glitch, pas de pixel overflow)
# 5. Prendre une capture d'écran
```

**Assertion:** Créer un test de rendu visuel qui génère des PNG pour chaque style et les compare contre des références.

---

### 3. Seek (scrubber drag) sans test automatisé

**État actuel:**
- ✅ Rejeu borné à une seule région, coût passé de 42–143ms à 14–34ms
- ✅ Vérifiée à la main (peu importe la position du drag)
- ❌ Aucun test automatisé

**À faire:**
```typescript
// Ajouter test dans __tests__/lib/whiteboard-animation/

test('Seek to arbitrary positions returns correct frame', async () => {
  const timeline = getTimeline(); // Duration ~12s
  const engine = createAnimationEngine(timeline);
  
  // Chercher à plusieurs positions
  for (const time of [0, 2.5, 5.0, 7.5, 10.0, 11.9]) {
    const frame = engine.seekTo(time);
    
    // Vérifier qu'on est à ±50ms de la position cible
    expect(Math.abs(frame.currentTime - time)).toBeLessThan(0.05);
  }
});
```

**Résultat attendu:** Temps de seek constant (~14-34ms) quel que soit la cible.

---

### 4. Drag continu du scrubber

**État actuel:**
- ❌ Pas de test automatisé
- ❌ L'outil d'automatisation n'émet qu'un seul événement de position

**À faire:**
```typescript
// Tester un drag continu: mousedown → mousemove (multiple) → mouseup

test('Continuous scrubber drag updates playback smoothly', async () => {
  const element = document.querySelector('[data-testid="timeline-scrubber"]');
  
  // Simuler drag de 2s à 10s
  const startX = 100;
  const endX = 500;
  
  fireEvent.mouseDown(element, { clientX: startX });
  
  // Émiter plusieurs événements mousemove pendant le drag
  for (let x = startX; x <= endX; x += 20) {
    fireEvent.mouseMove(element, { clientX: x });
    await waitFor(() => {
      // Vérifier que currentTime progresse correctement
      expect(engine.currentTime).toBeGreaterThan(2);
    });
  }
  
  fireEvent.mouseUp(element);
});
```

**Résultat attendu:** Lecture fluide, sans saut ou perte d'images.

---

### 5. "Retard de la main" d'origine jamais confirmé

**Hypothèses testées et écartées:**
- Écart horizontal de Scanner: −1 px ❌
- Calibration des mains 1–3: 1 px ❌
- Waypoints d'OutlineFill: Triés, 0 inversion ❌

**Défaut trouvé et corrigé:**
- ✅ Débordement vertical de la pointe hors de l'annotation en fin de balayage (jusqu'à 22 px)
  - Commit: `da25fd0`

**À faire:** 
```bash
# Confirmer que c'était bien le problème du "retard"
# 1. Générer une annotation simple avec Scanner en mode portrait
# 2. Observer que la main touche correctement le trait
# 3. Vérifier qu'il n'y a pas de décalage vertical excessif
# 4. Comparer avant/après le commit da25fd0
```

**Assertion:** Si on trouve toujours un retard, revenir aux hypothèses écartées et mesurer plus précisément.

---

## Test Fixtures Requises

Pour automatiser les vérifications, il faut:

1. **Annotation simple (test setup):**
   ```typescript
   {
     x: 100, y: 100, width: 200, height: 200,
     from: 0, to: 3000, durationMs: 3000,
     style: 'scanner'
   }
   ```

2. **Portée du test:** Tous les 13 styles, tous les aspect ratios (16:9, 9:16, 1:1)

3. **Metriques à capturer:**
   - Temps de rendu (ms)
   - Pixel overflow (px)
   - Continuité du tracé (% couvert)
   - Alignement (offset du centroïde)

---

## Priority

| Vérification | Priorité | Effort | Note |
|---|---|---|---|
| Portrait playback | ⭐⭐⭐ | 30m | Blocker connu depuis début |
| Styles visuels | ⭐⭐ | 1h | Déjà dans smoke test, juste visuel |
| Seek test | ⭐⭐ | 20m | Régression protection |
| Drag continu | ⭐⭐ | 30m | Edge case important |
| Confirmation retard main | ⭐ | 15m | Confirmer fix antérieur |

---

## Related Sections

- **3.1** ✅ Mains verticales calibrées
- **3.2** - Delta 100ms (limitation architecturale)
- **5** ✅ Panneaux parallèles alignés
- **7** - Santé repo (17→7 erreurs TS)
