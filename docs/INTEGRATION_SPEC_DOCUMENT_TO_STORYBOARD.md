# Import de document dans le studio storyboard

**Statut** : spec d'intégration, 2026-09-19
**Principe** : aucune nouvelle table, aucune nouvelle page. Une option d'import dans l'étape `prompt` qui remplit le brief existant.

## 1. Ce qui existe déjà

Le parcours `app/(protected)/storyboard/page.tsx` fait déjà « contenu → vidéo » :

| Étape | Code existant | Entrée |
|---|---|---|
| `prompt` | `components/organisms/storyboard/prompt-wizard.tsx` | `brief` (texte libre) |
| Script | `POST /api/generate-script` | `content` : 10 à 50 000 caractères |
| Découpage | `POST /api/generate-storyboard` | `script` validé par l'utilisateur |
| Images, narration | `/api/generate-images`, `/api/generate-narration` | scènes |
| `whiteboard` | `WhiteboardEditorStep` + `resoudreStyleAnnotation` | annotations |
| Export | `RenderJob` | projet |

Persistance : `VideoProject` (`params`, `script`, `panels`, `whiteboardConfig` en JSON). Facturation : `chargeFor(viewer, action, ...)`. Débit : `aiGenerationRateLimit`.

Il ne manque qu'une chose : transformer un fichier en texte pour remplir `brief`.

## 2. Ce qu'on ajoute

### 2.1 Route d'extraction

`POST /api/documents/extract`, en `multipart/form-data` avec un champ `file`.

- Garde : `requireViewer()`, puis `aiGenerationRateLimit(userId, "extract")`.
- Formats : `.pdf`, `.md`, `.txt`, `.docx`. Taille max : 10 Mo.
- Extraction : `.md` et `.txt` lus tels quels, `.pdf` via `pdf-parse`, `.docx` via `mammoth`. Aucune des deux n'est installée aujourd'hui.
- Sortie : `{ success: true, data: { text, truncated, pageCount?, title } }`.
- Si le texte dépasse 50 000 caractères, on coupe à 50 000 et on renvoie `truncated: true`, parce que `generate-script` refuse au-delà.
- Pas de stockage du fichier : le texte part dans le brief, et le brief est déjà persisté par `VideoProject.params`.
- Pas de `chargeFor` : l'extraction ne coûte rien. Le crédit est débité au `generate-script` qui suit, comme aujourd'hui.

Erreurs :

| Cas | Statut |
|---|---|
| Pas de session | 401 |
| Format non supporté ou fichier > 10 Mo | 400 |
| PDF scanné sans texte (extraction vide) | 422 « Ce PDF ne contient pas de texte sélectionnable » |
| Débit dépassé | 429 |

### 2.2 Option dans `PromptWizard`

Un bouton secondaire « Importer un document » à côté du champ brief (action principale d'abord, le reste derrière une seule entrée).

- Au choix d'un fichier : appel de `/api/documents/extract`, puis `onBriefChange(text)`.
- Si `truncated` : message sous le champ, « Document tronqué à 50 000 caractères ».
- Ensuite rien ne change : l'utilisateur relit le brief, clique Générer, le flux habituel reprend.

Aucune modification de `page.tsx` n'est nécessaire au-delà de ce que `PromptWizard` expose déjà (`brief`, `onBriefChange`).

### 2.3 Paramètre « format » orienté formation (optionnel, phase 2)

`generate-script` accepte déjà `format: "brief" | "explainer"`, `targetAudience` et `tone`. Pour les documents de type SOP ou onboarding, on peut ajouter `format: "training"` dans `requestSchema` et dans `buildScriptPrompt` (`lib/storyboard/script-generation.ts`), avec une consigne : une scène par étape de procédure, et un récapitulatif en fin de vidéo. C'est à faire seulement si les scripts `explainer` tirés de vrais documents se révèlent mal découpés.

## 3. Place de SkeletonTrace

SkeletonTrace reste un style parmi d'autres, et il n'est pas propre au flux document. Aujourd'hui il est enregistré dans `AnimationFactory` mais **aucun chemin automatique ne le choisit** : `resoudreStyleAnnotation` n'y mène jamais.

Branchement proposé, dans `lib/whiteboard-animation/lib/resoudre-style-annotation.js` :

- un rôle `drawing` dont la région est majoritairement du trait fin (peu de remplissage) → `skeletontrace` ;
- `diagram` / `flow` si le modèle d'annotation émet ces rôles → `skeletontrace`.

Le choix manuel (`animStyle`) garde la priorité, comme pour les autres styles. Il faut aussi vérifier que le sélecteur de style de l'éditeur liste `skeletontrace`.

## 4. Hors périmètre

- URL et Notion : même route plus tard, avec une récupération côté serveur (qui implique une protection SSRF).
- OCR des PDF scannés.
- « Régénérer la vidéo quand le document change » : cela demande de stocker le document et de faire un diff. On en parlera après un premier retour utilisateur.
- Nouveau modèle Prisma : inutile tant que le fichier n'est pas conservé.

## 5. Tâches

1. `npm i pdf-parse mammoth`, puis la route `app/api/documents/extract/route.ts` avec son schéma Zod et ses tests (md, txt, pdf avec texte, pdf vide → 422, troncature).
2. Bouton d'import dans `prompt-wizard.tsx`, avec états de chargement, d'erreur et de troncature.
3. Diagramme `docs/storyboard/document-import.puml` : cas nominal, 400, 401, 422, 429.
4. Règle `skeletontrace` dans `resoudreStyleAnnotation`, avec un test.
5. Phase 2, selon les retours : `format: "training"`.
