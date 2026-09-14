# Issue Tracker — Workspace/Organizations/RBAC

État: 2026-09-14

## Problèmes Critique 🔴

### 1. Chargement des projets figé
**Priorité**: URGENTE  
**Impact**: Page `/workspace` non fonctionnelle  
**Symptôme**: Squelettes visibles mais données ne se chargent pas  
**Cause Supposée**: Gel navigateur (rendu React ou interaction CDP)  
**Action Requise**:
- [ ] Tester avec DevTools navigateur ouvert
- [ ] Vérifier `app/(protected)/workspace/page.tsx` — trop de squelettes?
- [ ] Vérifier la réaction aux 409 (ProjectLockedError)
- [ ] Simplifier le composant projet pour tester

---

## Problèmes Connus (du next-steps.md) ⚠️

### 2. Bandeau lecture seule affiche l'id au lieu du nom
**Priorité**: MOYENNE  
**Fichier**: `use-project-sync.ts` → lit `lockedBy` du 409  
**Cause**: `session.ts` `toErrorResponse()` renvoie `error.lockedById` (string) au lieu du nom  
**Fix**:
- [ ] Ajouter `lockedByName?: string` à `ProjectLockedError`
- [ ] Mettre à jour la classe d'erreur dans `lib/video-project/errors.ts`
- [ ] Mettre à jour `toErrorResponse()` pour renvoyer `{ lockedByName, lockedById, expiresAt }`
- [ ] Tester le bandeau lecture seule

### 3. `/organizations` (admin) ne vérifie pas les permissions `organization:*`
**Priorité**: CRITIQUE  
**Fichier**: `app/admin/organizations/page.tsx`  
**Cause**: Seulement `requireAdmin` check  
**Fix**:
- [ ] Ajouter `checkPermission(session.user.role, 'organization:read')`
- [ ] Documenter quelles permissions sont requises
- [ ] Tester avec un rôle sans permissions

### 4. better-auth exige e-mail vérifié pour accepter invitation
**Priorité**: BASSE  
**Impact**: UX confusion si e-mail non vérifié  
**Action Requise**:
- [ ] Vérifier le message d'erreur est clair
- [ ] Tests manuels avec compte non vérifié

### 5. Organisation personnelle peut pas être renommée
**Priorité**: BASSE  
**Action Requise**:
- [ ] Ajouter UI pour renommer "User's workspace" depuis le studio
- [ ] Endpoint PATCH `/api/auth/organization/[id]`
- [ ] Garde: `organization.isPersonal` → on peut renommer soi-même

### 6. Tests automatisés manquants
**Priorité**: BASSE  
**Manquent**:
- [ ] Requête aperçu (`app/api/video-projects/route.ts`) → loadPreviews()
- [ ] Actions `update-user` / `create-user` avec gardes RBAC
- [ ] Invitations (email, lien expiré, mauvais compte)

### 7. Pages admin rôles/permissions UX basique
**Priorité**: BASSE  
**Amélioration**:
- [ ] Matrice ressource × action au lieu de liste de cases
- [ ] Recherche pour les permissions
- [ ] Tests manuels pour valider UI

### 8. Doublon: `organization-manager.tsx` vs Page Membres
**Priorité**: BASSE  
**Action Requise**:
- [ ] Décider lequel garder (studio Members vs admin)
- [ ] Supprimer l'autre

---

## Tâches de Test Manuel Restantes 📝

### Workspace/Projects
- [ ] Vignettes 16:9, 9:16, sans image
- [ ] Recherche fonctionnelle
- [ ] Pagination
- [ ] Renommer projet
- [ ] Supprimer projet
- [ ] Badge "X is editing"

### New Project
- [ ] 3 formats (16:9, 9:16, carré)
- [ ] Création et redirection storyboard

### Organisation Personnelle
- [ ] Création auto au 1er login
- [ ] Nommage "User's workspace"
- [ ] Ouverture auto storyboard

### Sélecteur Organisation
- [ ] Changer org
- [ ] Créer org
- [ ] Rechargement liste

### Invitations
- [ ] Formulaire page Membres
- [ ] Email (si SMTP configurés)
- [ ] Lien secours "Copy link"
- [ ] `/invite/[id]` — non connecté
- [ ] `/invite/[id]` — mauvais compte
- [ ] `/invite/[id]` — expiré
- [ ] Refus invitation

### Membres
- [ ] Liste affichée
- [ ] Changement rôle
- [ ] Retrait membre
- [ ] Dernier owner bloqué
- [ ] Quitter org

### Admin
- [ ] `/users/[id]` — assigner rôle
- [ ] Champs désactivés sur soi-même
- [ ] `/roles/[id]` Super Admin
- [ ] Sidebar filtrée par permissions

---

## Plan de Travail Proposé

### Phase 1: Corriger les Critiques (1-2h)
1. Investiguer et corriger le freeze navigateur
2. Fixer `lockedByName` dans ProjectLockedError
3. Ajouter checks permissions sur `/organizations`

### Phase 2: Validation Tests (1-2h)
1. Tests manuels navigateur complets
2. Vérifier tous les edge cases
3. Documenter résultats

### Phase 3: Améliorations UX (1h)
1. Message erreur e-mail pour better-auth
2. Renommage org personnelle
3. Simplification pages admin

### Phase 4: Tests Auto (1-2h)
1. Ajouter tests pour aperçu vidéos
2. Tests rôles/permissions
3. Tests invitations

---

## Notes

- Diagrammes PlantUML validés ✅
- API endpoints répondent correctement ✅
- Blocage: Gel navigateur pendant chargement projets
- Server logs: OK (200 status, 400-600ms)
- Next step: Déboguer l'issue navigateur
