# Projet vidéo en base : `VideoProject`, clips rattachés et verrou d'édition

**Date** : 2026-09-05
**Chantier** : 2 sur 6 de « gestion complète d'un projet vidéo en base »
**Dépend de** : chantier 0 (socle organisation better-auth), livré
**Statut** : conception validée, prête pour le plan d'implémentation

---

## Pourquoi ce chantier existe

Un projet vidéo n'existe aujourd'hui que dans le navigateur. `lib/storyboard/store.ts`
est un store Zustand `persist` sur `localStorage` : titre, paramètres, script,
`storyboardPanels[]` et `whiteboardConfig` vivent dans un seul onglet. Vider le
stockage du navigateur perd le travail, et rien n'est partageable entre deux
membres d'une même organisation.

Deux modèles Prisma, `TimelineClip` et `Annotation`, sont bien en base — mais
orphelins. `TimelineClip.trackId` est une chaîne libre, il n'y a ni projet, ni
utilisateur, ni organisation en amont. Conséquence directe :
`app/api/clips/[clipId]/annotations/route.ts` ne vérifie rien du tout — ni
permission, ni même la présence d'une session — parce qu'il n'a personne à qui
rattacher le clip. **N'importe qui peut donc lire, créer et modifier les
annotations de n'importe quel clip, sans être connecté.** Ce chantier ferme ce
trou en donnant enfin un propriétaire aux clips.

Le socle du chantier 0 fournit ce qui manquait : `session.activeOrganizationId`
et le plugin `organization` de better-auth.

---

## Périmètre

### Dans le périmètre

- Le modèle `VideoProject`, rattaché à une organisation, avec ses documents
  persistés et son bail d'édition.
- `TimelineClip.videoProjectId` obligatoire, et la reprise des routes
  d'annotations existantes derrière la vérification d'accès.
- Les routes CRUD `/api/video-projects` et la sous-ressource `lock`.
- L'extension des `statements` du plugin `organization` avec une ressource
  `project`.
- Une page `/projects` minimale : liste, création, renommage, suppression.

### Hors périmètre

- **La persistance du contenu audio** — chantier 1 (stockage objet). Voir
  « Le piège de l'audio » ci-dessous : ce chantier refuse activement d'écrire
  des `data:` URL en base.
- **Le branchement de l'éditeur** : remplacer le `localStorage` du store,
  sauvegarde automatique, renouvellement périodique du bail — chantier 3. La
  page `/projects` navigue vers `/storyboard?project=<id>` sans que ce
  paramètre soit encore lu.
- L'historique de versions (chantier 4), les rendus en base (chantier 5).
- Le partage hors organisation, la duplication de projet, la corbeille visible.
- Le modèle `Scene` : **écarté**. Un panneau de storyboard reste un élément du
  document `panels`, et les clips se rattachent directement au projet. Ajouter
  un niveau intermédiaire aujourd'hui coûterait deux hiérarchies à maintenir
  pour un besoin que rien n'exprime encore.

---

## État des lieux vérifié

- `lib/auth.ts:132` déclare le plugin `organization` sans `accessControl` : il
  n'y a aucune ressource métier déclarée pour l'instant.
- `lib/auth-organization.ts` expose `chooseActiveOrganization` et
  `resolveActiveOrganization`, fonctions pures testées sans base. C'est le
  patron que suit ce chantier.
- `prisma/schema.prisma:318` définit `TimelineClip` (aucune relation entrante)
  et `:337` `Annotation` (rattachée au clip, en cascade).
- `lib/storyboard/schema.ts` définit déjà `projectParamsSchema`,
  `storyboardPanelSchema`, `transitionSchema` et `workflowStepSchema` — ils sont
  réutilisés tels quels, jamais redéclarés.
- `lib/storyboard/store.ts:145` (`serializeAudioTrack`) persiste la narration
  en `data:` URL base64.

---

## Conception

### Modèle de données

Nouveau modèle `VideoProject` :

| Champ | Type | Rôle |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `organizationId` | `String` → `Organization`, `onDelete: Cascade` | propriétaire, jamais nul |
| `createdById` | `String?` → `User`, `onDelete: SetNull` | informatif ; un départ n'efface pas le projet |
| `title` | `String @db.VarChar(255)` | listable, triable |
| `status` | `String @default("draft")` | `draft \| ready \| archived` |
| `step` | `String @default("prompt")` | dernière étape (`workflowStepSchema`) |
| `aspectRatio` | `String @default("16:9")` | en colonne : filtre de liste, et le chantier 5 le lit sans ouvrir le document |
| `params` | `Json` | `projectParamsSchema` |
| `script` | `Json` | `{ text: string }` |
| `panels` | `Json` | `storyboardPanelSchema[]` |
| `whiteboardConfig` | `Json` | `WhiteboardConfig`, sans contenu audio |
| `schemaVersion` | `Int @default(1)` | |
| `lockedById` | `String?` → `User`, `onDelete: SetNull` | porteur du bail |
| `lockExpiresAt` | `DateTime?` | |
| `deletedAt` | `DateTime?` | suppression douce |
| `createdAt` / `updatedAt` | | |

Index : `@@index([organizationId, deletedAt, updatedAt])` — la requête de liste ;
`@@index([lockExpiresAt])`.

Quatre colonnes `Json` séparées plutôt qu'un document unique : le chantier 3
sauvegardera le script, les panneaux et la configuration whiteboard à des
moments différents, et une écriture partielle ne doit pas réécrire le reste.

`script` est un objet et non une chaîne pour que le chantier 4 puisse y ajouter
des métadonnées sans migration.

`TimelineClip` gagne `videoProjectId String`, la relation en `onDelete: Cascade`
et `@@index([videoProjectId])`.

#### Le piège de l'audio

`whiteboardConfig.audio` porte aujourd'hui une narration entière en `data:` URL
base64. L'écrire dans une colonne `Json` à chaque sauvegarde ferait passer
plusieurs mégaoctets par requête, et produirait des lignes qu'il faudrait
désosser dès que le chantier 1 livrera le stockage objet.

Décision : la piste audio est persistée **sans son contenu**
(`{ name, durationMs, url: null }`), et l'API **rejette en `400`** tout document
contenant une URL éphémère (`data:` ou `blob:`, quelle que soit la casse) à
n'importe quelle profondeur. Le chantier 1 ou 3 remplacera `url` par une URL
d'asset. Conséquence assumée : dans ce chantier, un audio téléversé n'est pas
encore conservé en base.

**Exception, sur le seul champ `whiteboardConfig.audio.url`** : la valeur y est
*normalisée à `null`* au lieu d'être rejetée. Les deux règles ci-dessus se
contredisaient — l'URL d'exécution d'une piste est toujours une `blob:`
(`lib/storyboard/store.ts`), donc un rejet strict rendait toute sauvegarde
impossible après un téléversement, et la forme persistée décrite ici
inatteignable. Partout ailleurs, `data:` et `blob:` restent un `400` : l'image
d'un panneau en base64 est refusée, pas silencieusement effacée.

Conséquence à connaître : après un téléversement audio, l'enregistrement réussit
sans avertissement et la piste est perdue au rechargement. Le chantier 1 supprime
ce cas en donnant à l'audio une URL durable.

### Modules purs

Quatre fichiers sous `lib/video-project/`, chacun testable sans base ni requête.

**`schema.ts`** — schémas Zod des quatre colonnes, construits sur ceux de
`lib/storyboard/schema.ts`. Ajoute `videoProjectDocumentSchema` (chaque document
optionnel, pour un `PATCH` partiel, mais validé entier s'il est présent),
`createVideoProjectSchema`, `listVideoProjectsSchema`, et `assertNoDataUrl`.

**`lock.ts`** — l'horloge est un paramètre, jamais `Date.now()` interne :

```
LOCK_TTL_MS = 120_000
lockState(project, userId, now) → "free" | "held-by-me" | "held-by-other"
acquireLock(project, userId, now) → { lockedById, lockExpiresAt } | null
releaseLock(project, userId) → patch | null
```

Un bail expiré est `"free"` : l'expiration est une lecture, jamais une écriture,
donc aucune tâche de nettoyage. `acquireLock` sur `"held-by-me"` renouvelle,
ce qui rend la prise idempotente. Pas de reprise autoritaire : un bail de deux
minutes expire seul, un chemin de forçage serait une surface de plus à protéger
sans besoin.

**`access.ts`** — `canAct(role, action)`, `action ∈ { create, read, update,
delete }`. `owner` et `admin` : tout. `member` : tout sauf `delete`. Table
explicite, testée couple par couple.

**`repository.ts`** — la seule frontière Prisma.
`requireProjectAccess(projectId, session, action)` résout l'organisation active
via `resolveActiveOrganization`, charge le projet non supprimé, vérifie
l'appartenance, lit le rôle du membre, applique `canAct`, et rend
`{ project, role }` ou lève une erreur typée (`NotFound` / `Forbidden`).

**Un projet d'une autre organisation rend `NotFound`, jamais `Forbidden`** :
distinguer les deux confirmerait l'existence de projets que l'appelant n'a pas
le droit de voir.

### Permissions

`lib/auth.ts` reçoit un `accessControl` déclarant la ressource
`project: ["create", "read", "update", "delete"]` et les trois rôles. `canAct`
reste la table de référence testée ; les `statements` du plugin l'exposent pour
que l'interface et le chantier 3 interrogent les permissions sans dupliquer la
règle.

### Routes

Cinq routes, minces : parser (Zod) → `requireProjectAccess` → Prisma → réponse.

**`GET /api/video-projects`** — projets de l'organisation active,
`deletedAt: null`, triés par `updatedAt` décroissant, avec `page`, `limit` et
`search` (sur `title`), au format paginé de `CLAUDE.md`. Ne renvoie **pas** les
colonnes `Json` : `id, title, status, step, aspectRatio, updatedAt, createdBy`
et `lock`, où `lock` est `lockState` du point de vue de l'appelant. Un `panels[]`
complet par ligne rendrait la liste inutilisable.

**`POST /api/video-projects`** — `{ title }` plus les valeurs par défaut des
quatre documents. Exige `create`. `201`.

**`GET /api/video-projects/[id]`** — le projet entier, documents compris, plus
`lock: { state, byId, expiresAt }`.

**`PATCH /api/video-projects/[id]`** — champs de tête (`title`, `status`,
`step`, `aspectRatio`) et/ou documents, tous optionnels. Exige `update` **et**
`lockState === "held-by-me"`, sinon `409` avec le porteur courant. Le corps
passe par `videoProjectDocumentSchema` puis `assertNoDataUrl` — échec en `400`.
Un `PATCH` réussi renouvelle le bail : pendant une frappe continue, le chantier
3 n'aura pas besoin d'un battement séparé.

**`DELETE /api/video-projects/[id]`** — suppression douce (`deletedAt`), exige
`delete`. Un projet tenu par un autre rend `409`.

**`POST /api/video-projects/[id]/lock`** — prend ou renouvelle. `200` avec
`expiresAt` si libre ou déjà à nous ; `409` avec `{ lockedBy, expiresAt }`
sinon.
**`DELETE /api/video-projects/[id]/lock`** — relâche, seulement si on le tient.
`200` avec un corps : `apiCall` (`lib/client.ts:21`) appelle toujours
`response.json()`, donc une réponse vide ferait échouer le client partagé. Même
raison pour le `DELETE` d'un projet.

L'écriture du bail est un `updateMany` conditionnel :

```
WHERE id = ? AND (lockedById IS NULL OR lockedById = ? OR lockExpiresAt < now())
```

Deux membres qui cliquent en même temps ne peuvent donc pas l'obtenir tous les
deux : `count === 0` devient le `409`.

**Reprise de l'existant** : `app/api/clips/[clipId]/annotations/route.ts` et sa
variante `[annotationId]` chargent le clip avec son projet et passent par
`requireProjectAccess(clip.videoProjectId, session, "update")`. La forme des
réponses ne change pas.

### Interface

`app/(protected)/projects/page.tsx`, volontairement minimale — son rôle est de
rendre le chantier vérifiable à la main.

Une grille de cartes : titre, statut, ratio, date de modification, auteur, et un
badge « en cours d'édition par X » quand `lock.state === "held-by-other"`. Un
bouton « Nouveau projet » ouvrant une boîte de dialogue à un seul champ. Par
carte, un menu *Ouvrir* / *Renommer* / *Supprimer* (avec confirmation) ; les
deux dernières entrées sont masquées quand la permission manque, d'après la même
table que `canAct`. *Ouvrir* pointe vers `/storyboard?project=<id>` — ce
paramètre n'est lu par personne avant le chantier 3.

État vide explicite, skeleton pendant le chargement (`components/skeletons/`),
appels via `api` (`lib/client.ts`), erreurs en `toast` Sonner, formulaire selon
les règles de `CLAUDE.md`.

---

## Migration

Une seule migration, `add_video_project` :

1. Créer la table `VideoProject` et ses index.
2. **Supprimer les lignes existantes de `TimelineClip`** — données de dev, sans
   projet possible. `Annotation` part par cascade.
3. Ajouter `TimelineClip.videoProjectId` en `NOT NULL`, la clé étrangère en
   `ON DELETE CASCADE`, et son index.

L'étape 2 précède l'étape 3 : ajouter une colonne `NOT NULL` sur une table non
vide échouerait.

---

## Tests

Vitest, colocalisés en `*.test.ts` :

- `lock.test.ts` — bail libre, tenu par soi (renouvellement), tenu par un autre,
  tenu mais expiré, exactement à l'expiration. L'horloge étant un paramètre,
  aucun `vi.useFakeTimers`.
- `access.test.ts` — les douze couples rôle × action, une assertion par cas.
- `schema.test.ts` — document valide, `PATCH` partiel, panneau malformé rejeté,
  `data:` URL rejetée y compris imbriquée dans `whiteboardConfig.audio`.
- `repository.test.ts` — `requireProjectAccess` sur un double du client Prisma :
  autre organisation → `NotFound` (et non `Forbidden`), projet supprimé →
  `NotFound`, non-membre → `NotFound`, membre sans permission → `Forbidden`.

Les routes ne sont pas testées unitairement : une fois ces quatre modules en
place, elles ne portent plus de décision.

---

## Risques

- **Volume des documents.** Un `panels[]` avec beaucoup d'images en `data:` URL
  reste lourd même sans l'audio. `assertNoDataUrl` couvre tout le document, pas
  seulement l'audio, ce qui plafonne le problème — au prix de rendre le
  chantier 1 nécessaire plus tôt que prévu pour les images téléversées.
- **Bail contre autosave.** Deux minutes de TTL supposent que le chantier 3
  renouvelle. S'il ne le fait pas, un utilisateur qui réfléchit trois minutes
  perd son bail et son `PATCH` suivant échoue en `409`. Le renouvellement
  implicite sur `PATCH` limite le cas à une vraie inactivité.
- **Perte des clips existants.** La migration les supprime. Hypothèse à
  confirmer avant d'exécuter le plan : ces lignes sont des données de dev.
  `TimelineClip` n'ayant jamais eu de propriétaire ni d'écran de gestion, rien
  n'a pu s'y accumuler côté utilisateur — mais la vérification revient à qui
  applique la migration.

---

## Critères d'acceptation

1. `VideoProject` existe, rattaché à `Organization`, avec les quatre colonnes
   `Json`, `schemaVersion`, le bail et `deletedAt`.
2. `TimelineClip.videoProjectId` est `NOT NULL` et en cascade ; la migration
   passe sur une base repartie de zéro.
3. `lib/auth.ts` déclare un `accessControl` avec la ressource `project` et ses
   quatre actions.
4. Un membre d'une autre organisation qui demande un projet reçoit `404`, jamais
   `403`.
5. Un `PATCH` sans bail, ou avec le bail d'un autre encore valide, reçoit `409`.
6. Deux prises de bail concurrentes sur un projet libre : une seule réussit.
7. Un bail dont `lockExpiresAt` est dépassé est reprenable sans intervention.
8. Un `PATCH` dont un champ, à n'importe quelle profondeur, contient une `data:`
   URL reçoit `400`.
9. `GET /api/video-projects` ne renvoie aucune colonne `Json`.
10. `/api/clips/[clipId]/annotations` refuse une requête sans session (`401`) et
    un utilisateur qui n'appartient pas à l'organisation du projet du clip
    (`404`).
11. `/projects` liste, crée, renomme et supprime, et affiche le porteur du bail.
12. Un `member` ne voit pas l'entrée *Supprimer*, et un `DELETE` forcé à la main
    reçoit `403`.
13. `npx tsc --noEmit` et `npm test` passent.

---

## Suite

Le chantier 3 (éditeur branché) remplace le `persist` `localStorage` de
`lib/storyboard/store.ts` par ces routes, lit `?project=<id>`, et ajoute le
renouvellement périodique du bail. Il dépend aussi du chantier 1 pour l'audio et
les images, qui restent hors base ici.
