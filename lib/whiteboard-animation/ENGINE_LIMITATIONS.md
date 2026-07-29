# Whiteboard Animation Engine - Known Limitations

Documentation des limitations identifiées du moteur d'animations whiteboard. Ces limitations ne sont pas des bugs mais des caractéristiques de conception.

## 3.2: Delta Écrêté à 100ms

**Localisation:** `animation-engine.ts:65` - Boucle RAF

```typescript
const delta = Math.min(100, deltaMs)
```

**Impact:**
- Quand une frame dépasse 100ms, le temps au-delà est perdu
- L'horloge du moteur prend du retard sur l'horloge réelle
- La cadence *interne* reste correcte, mais la vitesse de défilement décroche

**Observations mesurées:**
- Style **Illustration** met ~16 s pour parcourir 11,2 s de timeline (au lieu de 12s)
- À Reveal speed 100, ratio mesuré était 1,81 au lieu de 2,5 théorique

**Cause:** Limitation du scheduling dans requestAnimationFrame - pas de compensation pour les longues frames.

**Mitigation actuelle:** Moteur figé au 1× fidèle (`FIDELE_1X`), donc pas d'effet sur export hors RAF.
L'aperçu peut montrer une durée incorrecte mais l'export final est correct.

**Futur fix (complexe):** 
- Remplacer accumulation de deltas par temps absolu
- Nécessite refactor de la boucle de rendu
- Affecterait les points de synchronisation de l'annotation

---

## 3.3: Granularité Absente pour 9 styles sur 13

**Paramètre:** `tuilesPourRegion` - taille de tuile en fonction de la région

**Styles supportés (4):**
- ChunkJump
- OutlineChunks  
- Scribble
- Specialized

**Styles sans granularité (9):**
- Contour
- Gesture
- Illustration
- Nervous
- Outline Fill
- Outline Only
- Scanner
- Spec Text
- Top Anchor

**Status:** ✅ **Cohérent par design**
Chaque style a ses propres paramètres de rendu. La granularité (taille de tuile) n'a de sens que pour les styles basés sur chunks.

**Si le besoin revient:**
- Ajouter `tuilesPourRegion` support style-par-style
- Revalider les tests smoke de chaque style
- Documenter le comportement attendu

---

## Related Issues

- **Section 3.1** ✅ - Mains verticales calibrées (RÉSOLU)
- **Section 3.2** - Delta écrêté (Limitation architecturale, pas de fix simple)
- **Section 4** - Export et audio (À implémenter à la demande)
- **Section 6** - Vérifications manquantes (Portrait playback, seek drag, etc.)

## Action Items

- [ ] Implémenter test de playback en portrait 9:16
- [ ] Ajouter test de drag continu sur scrubber
- [ ] Implémenter vérification visuelle des 6 nouveaux styles
- [ ] Si refactor du moteur: considérer temps absolu vs deltas accumulés
