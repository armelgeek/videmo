# Bibliothèque de formats vidéo

**Statut** : spec, 2026-09-19
**Principe** : un type de vidéo (brief, explainer, storytelling finance…) devient **une seule entrée de données**. Ajouter un format ne demande plus de toucher aux prompts, aux routes ni à l'interface.

Convention : l'explication est en français, tout ce qui est code (types, champs, fichiers, identifiants) est en anglais.

---

## 1. Le problème aujourd'hui

« brief » et « explainer » sont codés en dur à sept endroits :

| Endroit | Ce qui est figé |
|---|---|
| `app/api/generate-script/route.ts` | `format: z.enum(["brief", "explainer"])` |
| `app/api/generate-storyboard/route.ts` | même enum |
| `lib/storyboard/schema.ts` → `projectParamsSchema` | même enum, dans les paramètres enregistrés du projet |
| `lib/storyboard/script-generation.ts` → `paragraphCountForFormat` | `format === "brief" ? 6 : 10` |
| `lib/storyboard/script-generation.ts` → `buildScriptPrompt` | aucune consigne de structure propre au format : juste `Format: ${format}` |
| `lib/storyboard/image-generation.ts` → `buildImagePrompt` | vocabulaire d'explainer imposé à tous : chaque sujet étiqueté, flèches, encadrés |
| `components/organisms/storyboard/prompt-wizard.tsx` | les deux options et leurs textes d'aide |

Un nouveau type demande donc de modifier ces sept endroits, et le modèle ne reçoit presque rien qui le distingue.

**Bug trouvé en passant.** `buildBreakdownPrompt` écrit `Aspect ratio: the video is ${params.format} format`. Or `format` vaut `brief` ou `explainer`, pas un ratio : le modèle lit « the video is explainer format ». Le vrai ratio (`aspectRatio`) n'arrive jamais au découpage. À corriger dans la première tâche.

---

## 2. Le concept : un format = une recette complète

La « bibliothèque de prompts » évoquée devient une **bibliothèque de formats**. Un format ne se limite pas à un prompt : il décrit comment le script est structuré, comment il est découpé, à quoi ressemblent les images et quel style d'animation le moteur applique. Le moteur suit la recette.

```ts
// lib/storyboard/formats/types.ts
export interface VideoFormat {
  id: string;                    // "explainer", "story-personal-finance"… stocké dans le projet, ne change jamais
  version: number;               // incrémenté quand la recette change ; les projets gardent la leur
  label: string;                 // affiché dans le wizard
  hint: string;                  // une ligne sous le label
  family: "explainer" | "story";
  thumbnailUrl: string;          // /formats/<id>.webp, image réelle produite avec ce format

  script: {
    paragraphs: number;          // cible, remplace paragraphCountForFormat
    structure: string[];         // consignes de structure, injectées telles quelles dans buildScriptPrompt
    defaultTone: string;
  };

  breakdown: {
    rules: string[];             // consignes ajoutées à buildBreakdownPrompt (ex. « one image per procedure step »)
  };

  visual: VisualPreset;

  character?: FormatCharacter;   // famille "story" uniquement
}

export interface VisualPreset {
  id: string;
  vocabulary: string[];          // ce que les images contiennent : étiquettes, flèches, bulles, graphiques simples…
  accentColors: string[];        // ex. ["red", "orange", "blue"]
  labels: "every-subject" | "key-subjects" | "none";
  defaultAnimationStyle: string; // valeur passée à AnimationFactory (ex. "illustfill")
}

export interface FormatCharacter {
  description: string;           // injectée dans le prompt de chaque image où il apparaît
  referenceImageUrl: string;     // fournie avec le format, envoyée comme référence d'image
  name?: string;                 // prénom utilisé par le script, ex. "Léa"
}
```

### Ce qui reste fixe dans `buildImagePrompt`

Une partie du prompt image ne dépend pas du format : c'est **ce que le moteur d'animation sait lire**. Le commentaire en tête de `buildImagePrompt` explique pourquoi chaque règle existe (squelettisation, binarisation, découpe en rectangles). Tous les formats gardent donc :

- un fond blanc pur, sans texture ni teinte ;
- un trait continu d'épaisseur constante ;
- des sujets séparés, qui tiennent chacun dans leur rectangle ;
- aucune ombre, aucun dégradé, aucun photoréalisme ;
- aucun bloc de texte.

Le preset ne varie que sur le reste : vocabulaire, étiquettes, couleurs d'accent, personnage.

Concrètement, `buildImagePrompt` est découpé en deux :
- `ENGINE_CONSTRAINTS`, constant ;
- `presetSection(preset, character)`, généré à partir du format.

Le format explainer actuel doit produire **exactement** le prompt d'aujourd'hui. Un test de parité le vérifie, pour ne rien changer au rendu des projets existants.

---

## 3. Où chaque consommateur lit le format

| Consommateur | Avant | Après |
|---|---|---|
| Routes `generate-script` et `generate-storyboard` | `z.enum([...])` | `format: z.string().refine(isKnownFormat)` |
| `buildScriptPrompt` | `Format: ${format}` | `format.script.structure` + `format.script.paragraphs` (+ prénom du personnage si `story`) |
| `buildBreakdownPrompt` | ratio erroné | vrai `aspectRatio` + `format.breakdown.rules` |
| `buildImagePrompt` | vocabulaire explainer figé | `ENGINE_CONSTRAINTS` + section du preset |
| `/api/generate-images` | 1 référence (la 1ʳᵉ image) | jusqu'à 2 : 1ʳᵉ image + image du personnage |
| `PromptWizard` | 2 options en dur | liste lue depuis `listFormats()`, avec miniature |
| Éditeur whiteboard | style global par défaut | `format.visual.defaultAnimationStyle` quand le projet n'en a pas choisi |

Le registre :

```ts
// lib/storyboard/formats/index.ts
export function listFormats(): VideoFormat[];
export function getFormat(id: string): VideoFormat;   // repli sur "explainer" si l'id est inconnu, avec un log
export function isKnownFormat(id: string): boolean;
```

Un fichier par format dans `lib/storyboard/formats/` : `brief.ts`, `explainer.ts`, `story-personal-finance.ts`.

---

## 4. Choix et validation du visuel

La question posée : comment l'utilisateur valide-t-il le visuel ?

1. **Il choisit sur une miniature, pas sur un mot.** Le wizard montre chaque format avec sa miniature, une vraie image générée avec ce preset (même règle que la landing : captures réelles uniquement).
2. **Il valide la première image avant la série.** La page génère déjà la première case, puis s'en sert comme référence pour les suivantes (`page.tsx:561`). On ajoute un arrêt après cette première image : « Ce style vous convient ? » avec deux boutons, `Continuer` et `Régénérer`. Les autres images ne partent qu'après validation, ce qui évite de payer une série entière dans un style refusé.
3. **Cet arrêt reste léger.** Un seul écran, la décision par défaut étant « Continuer ». C'est cohérent avec la règle du studio : l'action principale d'abord, le reste derrière une seule entrée.

Le choix d'un **autre preset visuel que celui du format** n'est pas prévu en v1. S'il est demandé, il passera par un champ `visualPresetId` qui surcharge celui du format, derrière le même bouton « Réglages ».

---

## 5. Le storytelling avec personnage

Cas cible : une vidéo de finance personnelle racontée à travers un personnage récurrent. Par exemple, Léa découvre qu'elle dépense trop, met en place un budget, puis voit son épargne grandir.

- **Un seul personnage par format**, défini par nous et livré avec le format. Pas d'étape de casting, rien à configurer pour l'utilisateur.
- **Le script.** `structure` décrit l'arc : situation, problème, notions introduites au moment où le personnage en a besoin, leçon retenue. Le prompt donne le prénom du personnage et interdit d'en inventer d'autres.
- **Les images.** La description du personnage est ajoutée au prompt, et `referenceImageUrl` est envoyée comme référence, en plus de la première case. Le preset `story` utilise `labels: "key-subjects"`, parce qu'étiqueter le personnage à chaque image serait absurde.
- **Travail technique.** `OpenAIImageGenerator.callEdits` n'envoie aujourd'hui qu'une seule image. gpt-image-1 accepte plusieurs images en entrée via `image[]`. Il faut passer `reference?: Uint8Array` à `references: Uint8Array[]`. C'est à vérifier sur l'API au début de la tâche, avant d'écrire le reste.
- **Risque.** La cohérence du personnage n'est jamais parfaite avec les modèles actuels. À mesurer sur une vraie vidéo de 6 à 8 scènes avant de mettre ce format en avant (tâche 5).

---

## 6. Stockage et compatibilité

- **Le projet.** `VideoProject.params` est un JSON dont la clé `format` contient déjà `"brief" | "explainer"`. Elle devient l'identifiant du format : `projectParamsSchema.format` passe de `z.enum([...])` à `z.string().refine(isKnownFormat)`. On ajoute seulement `formatVersion`, optionnel. Aucune migration Prisma n'est nécessaire.
- **Les projets existants.** Leurs valeurs `brief` et `explainer` sont des identifiants valides : ils se chargent sans conversion ni repli.
- **Les versions.** Quand une recette change, `version` augmente. Un projet garde la version avec laquelle il a été généré, pour que « Régénérer une image » reste cohérent avec le reste de la série. En v1, on ne garde que la dernière version de chaque format : `formatVersion` sert juste à détecter un écart et à afficher « Ce format a été mis à jour ».

**Code ou base de données ?** On commence en code : typé, versionné dans git, testé, relu en PR. Le passage en base, pour éditer les formats depuis l'admin sans déployer, se fera quand il y aura plus de 5 ou 6 formats. `listFormats()` et `getFormat()` sont déjà la frontière : le jour venu, seule leur implémentation change.

---

## 7. Formats de départ

| id | family | Pourquoi |
|---|---|---|
| `brief` | explainer | existant, repris à l'identique (6 paragraphes) |
| `explainer` | explainer | existant, repris à l'identique (10 paragraphes), test de parité du prompt image |
| `story-personal-finance` | story | nouveau cas, valide le personnage et la famille `story` |

`cooking-tutorial` a été évoqué ; il viendra une fois que le mécanisme aura fait ses preuves sur `story-personal-finance`.

---

## 8. Tests et diagramme

- **Parité** : le prompt image et le prompt script de `explainer` et de `brief` sont identiques octet pour octet à ceux d'aujourd'hui.
- **Registre** : ids uniques, `getFormat` retombe sur `explainer` pour un id inconnu, chaque format a une miniature qui existe dans `public/formats/`.
- **Routes** : un `format` inconnu renvoie 400 ; un ancien projet (`format: "brief"` ou `"explainer"`) se charge sans conversion.
- **Personnage** : `buildImagePrompt` contient la description du personnage et `generate-images` envoie deux références quand le format en a un.
- **Diagramme** : `docs/storyboard/video-formats.puml`, flux complet. Il couvre le choix du format, le script, le découpage, la première image, puis la validation (`Continuer` ou `Régénérer`) et le reste de la série. Cas d'erreur : 400 (format inconnu), 401, 429, 502 (sortie du modèle inutilisable).

---

## 9. Tâches

1. Créer `lib/storyboard/formats/` (types, registre, `brief`, `explainer`), puis brancher `buildScriptPrompt`, `buildBreakdownPrompt` et les deux routes. Au passage, corriger le bug du ratio dans le découpage. Tests de parité.
2. Découper `buildImagePrompt` en `ENGINE_CONSTRAINTS` + `presetSection`, avec un test de parité pour `explainer`.
3. Passer `PromptWizard` sur `listFormats()` avec les miniatures, et élargir `projectParamsSchema.format` aux formats connus.
4. Ajouter l'arrêt de validation après la première image.
5. Créer `story-personal-finance` : prompts, personnage et son image de référence, puis l'envoi de plusieurs références dans `OpenAIImageGenerator`. Mesurer la cohérence sur une vidéo de 6 à 8 scènes avant de l'exposer.
6. Écrire le diagramme `video-formats.puml`.
