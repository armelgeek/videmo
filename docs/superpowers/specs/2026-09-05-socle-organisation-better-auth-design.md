# Socle organisation : passer au plugin `organization` de better-auth

**Date** : 2026-09-05
**Chantier** : 0 sur 6 de « gestion complète d'un projet vidéo en base »
**Statut** : conception validée, prête pour le plan d'implémentation

---

## Pourquoi ce chantier existe

La gestion complète d'un projet vidéo en base a besoin d'un propriétaire et de
permissions. Le choix retenu est l'édition à plusieurs au sein d'une
organisation, avec un verrou d'écriture — donc chaque projet devra se rattacher
à une organisation et interroger le rôle du membre qui l'ouvre.

Or ce socle n'existe pas. `lib/auth.ts:113` n'active que `emailOTP` et
`twoFactor` : le plugin `organization` de better-auth n'est pas branché, alors
que la version installée (`better-auth@^1.4.18`) le fournit. Les organisations
sont faites main — trois modèles Prisma et deux routes écrites à la main.

Rattacher les projets aux modèles faits main, puis migrer vers le plugin plus
tard, reviendrait à migrer deux fois la même relation. Ce chantier passe donc
en premier, et seul.

### Ce que le plugin apporte et qui manque aujourd'hui

| | Fait main (actuel) | Plugin |
|---|---|---|
| Organisation active en session | absente, à passer à la main partout | `session.activeOrganizationId` |
| Permissions | `role` en `String` libre, comparé par un `roleRank` local | contrôle d'accès typé, `hasPermission` |
| Invitations | modèle présent, flux jamais écrit | flux complet fourni |

---

## Périmètre

### Dans le périmètre

- Activer le plugin `organization` côté serveur et côté client.
- Faire pointer le plugin sur les tables existantes, sans les renommer.
- Migrer le schéma : `Session.activeOrganizationId`, abandon de
  `Organization.ownerId`, remplacement de `OrganizationInvitation`.
- Résoudre l'organisation active à la connexion.
- Supprimer les deux routes faites main et réécrire `organization-manager.tsx`
  sur le client better-auth.

### Hors périmètre

- Le modèle `VideoProject` et tout ce qui touche aux projets vidéo — chantier 2.
- Le flux d'invitation côté interface. Le plugin fournit les points d'entrée ;
  les brancher dans l'écran est un travail distinct, non nécessaire au
  rattachement des projets.
- Les équipes (`team`) et les rôles dynamiques (`organizationRole`), que le
  plugin sait gérer mais dont rien n'a besoin ici.

---

## État des lieux vérifié

Surface totale des organisations dans le dépôt :

| Élément | Emplacement |
|---|---|
| Modèles | `prisma/schema.prisma:241-281` — `Organization`, `OrganizationMember`, `OrganizationInvitation` |
| Routes | `app/api/organizations/route.ts`, `app/api/organizations/[id]/members/route.ts` |
| Interface | `components/templates/organization-manager.tsx` |
| Page | `app/(protected)/(admin)/organizations/page.tsx` |

`OrganizationInvitation` n'est référencé par aucun fichier de `app/`,
`components/`, `lib/` ni `actions/`. C'est un modèle mort : la table est vide
par construction.

---

## Conception

### Modèle de données

Le plugin attend des modèles nommés `organization`, `member` et `invitation`.
Il accepte des surcharges `modelName` et `fields`, qu'on utilise pour le faire
pointer sur les tables existantes. **Aucune table n'est renommée et aucune
donnée d'organisation ou de membre n'est déplacée.**

| | Champs du plugin | Champs actuels | Décision |
|---|---|---|---|
| `Organization` | name, slug, logo, createdAt, updatedAt, metadata | name, slug, logo, createdAt, updatedAt, **description**, **ownerId** | `description` déclaré en `additionalFields` ; `metadata` non utilisé ; `ownerId` supprimé |
| `OrganizationMember` | organizationId, userId, role, **createdAt** | organizationId, userId, role, **joinedAt** | surcharge `fields: { createdAt: "joinedAt" }` |
| `OrganizationInvitation` | organizationId, email, role, **status**, expiresAt, createdAt, **inviterId** | organizationId, email, role, **token**, expiresAt, **acceptedAt**, createdAt | table vide, remplacée par la forme du plugin |

#### Abandon de `ownerId`

Le plugin n'a pas de notion de propriétaire sur l'organisation : le
propriétaire est le membre dont le `role` vaut `owner`. La route `POST`
actuelle crée déjà cette ligne en même temps que l'organisation
(`app/api/organizations/route.ts:64`). Conserver `ownerId` en plus, ce serait
deux vérités pouvant diverger.

La colonne est donc supprimée, mais seulement **après** que son information a
été transférée : voir « Remplissage » ci-dessous.

#### `Session.activeOrganizationId`

Colonne nullable ajoutée à `Session`. C'est ce qui rend l'organisation courante
lisible partout sans la transmettre à la main — ce dont le chantier 2 a besoin
pour rattacher un projet et pour vérifier le droit d'ouvrir un verrou.

#### Production du schéma

Les modèles sont générés par `npx @better-auth/cli generate` puis **relus et
ajustés à la main** pour conserver les noms de tables existants. Le plugin fait
foi sur sa propre forme ; on ne l'écrit pas de mémoire.

### Permissions

Aucun contrôle d'accès à définir. Les trois rôles livrés par le plugin
(`node_modules/better-auth/dist/plugins/organization/access/statement.mjs`)
encodent exactement le `roleRank` écrit à la main dans
`app/api/organizations/[id]/members/route.ts:12` :

```
ownerAc  → organization: ["update","delete"], member: ["create","update","delete"], invitation: ["create","cancel"]
adminAc  → organization: ["update"],          member: ["create","update","delete"], invitation: ["create","cancel"]
memberAc → aucune permission d'écriture
```

La route `DELETE /members` exige aujourd'hui le rôle `admin` pour retirer un
membre ; le plugin refuse la même opération via `member: ["delete"]`. Le
comportement observable est inchangé.

Le chantier 2 étendra les `statements` avec une ressource `project` sans
toucher à ces trois rôles.

### Organisation active

Le champ est posé à la création de session par un
`databaseHooks.session.create.before`. La logique de sélection est extraite en
fonction pure, dans son propre fichier, pour être testable sans base ni
session :

```
choisirOrganisationActive(memberships) -> organizationId | null
```

Règles :

- aucune appartenance → `null` ;
- une seule → celle-là ;
- plusieurs → la plus récemment rejointe, d'après `joinedAt`.

**Sessions déjà ouvertes.** Le hook ne s'applique qu'aux nouvelles connexions.
Les sessions existantes restent valides — le champ est nullable, personne n'est
déconnecté — mais leur `activeOrganizationId` vaut `null`. Une résolution
paresseuse couvre ce cas : à la première lecture qui trouve `null` alors que
l'utilisateur a au moins une appartenance, on applique la même fonction et on
écrit le résultat dans la session. Aucune déconnexion générale n'est nécessaire.

### Routes et interface

Les deux routes faites main sont **supprimées**. Le plugin expose ses propres
points d'entrée sous `/api/auth/organization/*`, avec les contrôles de rôle
intégrés ; les conserver reviendrait à maintenir des passe-plats et à
réimplémenter des vérifications déjà faites.

`components/templates/organization-manager.tsx` appelle désormais
`authClient.organization.*`. Deux points d'attention :

- le composant lit aujourd'hui `_count.members`, que le plugin ne renvoie pas
  sur la liste ; le compte vient de `getFullOrganization` ;
- `lib/auth-client.ts` doit déclarer `organizationClient()` en regard du plugin
  serveur, sur le modèle des plugins `emailOTP` et `twoFactor` déjà présents.

---

## Migration

Un seul fichier de migration Prisma, dans cet ordre strict :

1. **Ajouter** `Session.activeOrganizationId`, nullable. Aucune donnée touchée.
2. **Remplir** : pour chaque organisation sans membre de rôle `owner`, insérer
   cette ligne depuis `Organization.ownerId`. Idempotent, sans effet si les
   données sont déjà cohérentes.
3. **Supprimer** `Organization.ownerId`, une fois l'information transférée.
4. **Remplacer** `OrganizationInvitation` par la forme du plugin — ajout de
   `status` et `inviterId`, suppression de `token` et `acceptedAt`.

L'ordre importe : inverser 2 et 3 perdrait l'identité du propriétaire des
organisations dont la ligne de membre manquerait.

---

## Tests

| Unité | Vérification |
|---|---|
| `choisirOrganisationActive` | Vitest : aucune appartenance, une seule, plusieurs (la plus récente gagne), appartenance révoquée |
| Résolution paresseuse | Vitest : session à `null` avec appartenances → écrit l'organisation ; session à `null` sans appartenance → reste `null` |
| Configuration du plugin | Test qui monte `auth` et assère que les surcharges pointent sur `OrganizationMember` et `joinedAt` |
| Remplissage de migration | Script de contrôle post-migration : chaque organisation a au moins un membre de rôle `owner` ; le nombre de lignes de `OrganizationMember` n'a pas diminué |
| Suppression des routes | Recherche d'occurrences résiduelles de `/api/organizations` dans le dépôt |

---

## Risques

| Risque | Portée | Traitement |
|---|---|---|
| La migration touche `Session` | Tous les utilisateurs connectés | Champ nullable, aucune déconnexion ; résolution paresseuse pour les sessions antérieures |
| `organization-manager.tsx` est réécrit | Un écran d'administration | Le contrat de l'interface ne change pas pour l'utilisateur ; seuls les appels changent |
| `OrganizationInvitation` est remplacée | Aucune donnée | Table vérifiée vide par absence totale de référence dans le code |
| Perte de `ownerId` | Identité du propriétaire | Remplissage avant suppression, dans la même migration, avec contrôle post-migration |

---

## Critères d'acceptation

1. `lib/auth.ts` déclare le plugin `organization`, pointant sur
   `OrganizationMember` et `joinedAt`, avec `description` en `additionalFields`.
2. `lib/auth-client.ts` déclare `organizationClient()`.
3. Une connexion produit une session dont `activeOrganizationId` vaut
   l'organisation attendue, ou `null` si l'utilisateur n'en a aucune.
4. `Organization.ownerId` n'existe plus, et chaque organisation a au moins un
   membre de rôle `owner`. Le remplissage n'en crée un que s'il manque : une
   organisation qui en aurait déjà plusieurs est laissée telle quelle, le
   plugin ne l'interdisant pas.
5. `app/api/organizations/**` n'existe plus, et aucune occurrence de ce chemin
   ne subsiste dans le dépôt.
6. L'écran d'administration des organisations liste, crée et retire un membre
   comme avant, en passant par `authClient.organization.*`.
7. Un membre de rôle `member` ne peut pas retirer un autre membre.
8. `npx tsc --noEmit` et la suite Vitest passent.

---

## Suite

Ce chantier ne livre rien de visible à l'utilisateur final : c'est un socle.
Les cinq chantiers suivants s'appuient dessus.

| # | Chantier | Dépend de |
|---|---|---|
| 1 | Stockage objet (`Asset`, S3, service authentifié) | — |
| 2 | Projet & scènes (`VideoProject`, `Scene`, verrou d'édition) | 0 |
| 3 | Éditeur branché (remplacer le `localStorage`, sauvegarde automatique) | 1, 2 |
| 4 | Historique de versions | 3 |
| 5 | Rendus en base | 1, 2 |

Le chantier 1 ne dépend pas de celui-ci et peut être mené en parallèle.
