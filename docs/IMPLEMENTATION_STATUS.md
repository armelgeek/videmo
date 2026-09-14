# Implementation Status — Workspace/Organizations/RBAC

État: 2026-09-14  
Session: https://claude.ai/code/session_01LGbGCxCviPcEVLQk7zC4Ey

---

## ✅ Complété

### Diagrammes PlantUML (CLAUDE.md requis)
- [x] `docs/features/workspace-projects.puml` — 300+ lignes
  - Cas nominaux: charger liste, rechercher, créer, renommer, supprimer
  - Edge cases: 401, 403, 409, 400
  - DB queries: FindMany, Count, Left Join pour `lockedByUser.name`
  - Org personnelle auto-créée au 1er login

- [x] `docs/organization/invitations.puml` — 250+ lignes
  - Flow complet: envoi, e-mail, lien 6h, acceptation
  - Cas nominal: connecté, non connecté (redirection login)
  - Edge cases: mauvais email, token expiré, déjà membre
  - Validation: e-mail vérifié (better-auth enforced)

- [x] `docs/auth/rbac-role-assignment.puml` — 280+ lignes
  - Attribution de rôle: client + server validation
  - Super Admin: read-only, pas d'auto-modification possible
  - Hiérarchie de rôles: pas de promotion au-dessus du sien
  - Permissions centralisées: `lib/rbac.ts` vérifié

### Documentation & Tracking
- [x] `docs/TEST_MANUAL.md` — Checklist tests navigateur avec résultats initiaux
- [x] `docs/next-steps.md` — État au 2026-09-14 (3 commits, permissions, tests)
- [x] `docs/ISSUE_TRACKER.md` — Priorisation 8 problèmes (critique → basse)
- [x] `docs/IMPLEMENTATION_STATUS.md` — Ce fichier

### Corrections Critiques RBAC
- [x] **ProjectLockedError** — Ajouter `lockedByName` pour afficher le nom du verrouilleur
  - Classe: `lib/video-project/errors.ts` (+1 param)
  - Réponse: `session.ts` `toErrorResponse()` retourne `lockedByName || lockedById`
  - Prêt pour implémentation du verrouillage

- [x] **Admin `/organizations`** — Ajouter check permissions `organization:read`
  - Avant: Seulement `requireAdmin` (flou)
  - Après: `hasPermission(userId, "organization", "read")`
  - Redirection: `/unauthorized` si pas de permission
  - Aligne avec architecture RBAC centralisée

### Tests & Validation API
- [x] Serveur de dev lancé (`http://localhost:3000`)
- [x] API endpoints testées:
  - `GET /` → 200 (1883ms, home page)
  - `GET /workspace` → 200 (418ms)
  - `GET /api/video-projects?page=1` → 200 (409ms, liste projects)
  - `GET /api/auth/get-session` → 200 (949ms)
  - `GET /api/auth/organization/*` → 200 (610-629ms)
- [x] Page d'accueil fonctionnelle (2 boutons: New Project, Workspace)
- [x] Navigation authentifiée (pas de redirection login pour utilisateur connecté)
- [x] Sidebar chargée (New project, Projects, Members, Organization)

---

## ⚠️ En Cours / Bloqué

### Gel Navigateur lors Chargement Projets
**État**: ENQUÊTE EN COURS  
**Symptôme**: Page `/workspace` ne rend pas les projets, squelettes visibles mais figés  
**Données**: API répond 200 en 400-600ms, serveur OK  
**Cause Probable**:
- Requête SQL complexe `loadPreviews()` dans `app/api/video-projects/route.ts`
- Grand nombre de squelettes React
- Ou interaction CDP/navigateur

**Prochaine Étape**: Tester avec DevTools, simplifier requête SQL, vérifier composants

---

## ❌ À Faire (Priorité Baisse)

### Tests Manuels Restants
- [ ] Workspace: vignettes, recherche, pagination, renommer, supprimer, badge édition
- [ ] New Project: 3 formats, création, redirection storyboard
- [ ] Organisation Personnelle: auto-création, nommage
- [ ] Sélecteur Org: changer, créer, rechargement
- [ ] Invitations: formulaire, email, liens, edge cases
- [ ] Membres: affichage, rôles, retrait, dernier owner, quitter
- [ ] Admin: rôles, permissions, Super Admin, sidebar filtrée

### Améliorations UX/Fonctionnalité
- [ ] Better-auth e-mail vérifié — message d'erreur plus clair
- [ ] Organisation personnelle — pouvoir renommer depuis le studio
  - UI: Bouton "rename" à côté du nom
  - Endpoint: PATCH `/api/auth/organization/[id]`
  - Garde: `organization.isPersonal` → self-only

- [ ] Pages admin UX — Matrice ressource × action au lieu de cases
- [ ] Doublon: Décider entre `organization-manager.tsx` (admin) et Members page (studio)

### Tests Automatisés
- [ ] Requête aperçu vidéos (`loadPreviews()` query)
- [ ] Actions `update-user`, `create-user` avec gardes RBAC
- [ ] Invitations (envoi, acceptation, edge cases)

---

## Architecture Décisions (Confirmées)

✅ **Organisations restent** — Chaque projet vidéo appartient à une organisation  
✅ **Rôles globaux** — Appliqués seulement si `isAdmin=true`  
✅ **Super Admin** — Accès implicite, pas d'auto-modification  
✅ **RBAC Centralisé** — `lib/rbac.ts` source unique vérifiée  
✅ **Organisation Personnelle** — Auto-créée `isPersonal=true`, nommée `"User's workspace"`

---

## Commits Réalisés

```
8886013 fix: Corrections critiques pour RBAC et gestion des verrous
c1df954 docs: Plan d'action pour les problèmes connus
62cbdfe docs: PlantUML diagrams et manual tests pour workspace/organizations/rbac
```

---

## Ressources

- **Diagrammes**: `docs/features/`, `docs/organization/`, `docs/auth/`
- **Tests**: `docs/TEST_MANUAL.md`, `docs/ISSUE_TRACKER.md`
- **RBAC**: `lib/permissions.ts`, `lib/rbac.ts`, `lib/check-permission.ts`
- **Erreurs**: `lib/video-project/errors.ts`, `lib/video-project/session.ts`

---

## Prochaines Étapes

**Haute Priorité** (1-2h):
1. Déboguer gel navigateur `/workspace`
2. Valider corrections RBAC
3. Tests manuels complets

**Moyenne Priorité** (1h):
1. Améliorer messages erreur
2. UX renommage org perso
3. Nettoyage doublons (admin)

**Basse Priorité** (1-2h):
1. Tests automatisés
2. Matrice rôles/permissions
3. Documentation finale
