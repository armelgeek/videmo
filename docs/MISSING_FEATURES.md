# Fonctionnalités Manquantes — À Implémenter

État: 2026-09-14

---

## 🔍 AUDIT: Endpoints & Pages

### ✅ EXISTANTS

**API Projets**:
- [x] GET `/api/video-projects` — liste + aperçu
- [x] POST `/api/video-projects` — créer
- [x] GET `/api/video-projects/[id]` — détails
- [x] PATCH `/api/video-projects/[id]` — renommer
- [x] DELETE `/api/video-projects/[id]` — supprimer
- [x] POST `/api/video-projects/[id]/lock` — verrouiller
- [x] DELETE `/api/video-projects/[id]/lock` — déverrouiller

**API Invitations**:
- [x] GET `/api/auth/organization/invitations/[id]` — détails ✅ NEW
- [x] POST `/api/auth/organization/invitations/[id]/accept` — accepter ✅ NEW
- [ ] POST `/api/auth/organization/invitations` — **ENVOYER** (manquant!)
- [ ] GET `/api/auth/organization/invitations` — lister (manquant?)

**Pages**:
- [x] `/workspace` — liste projets
- [x] `/workspace/members` — gestion membres + invitations
- [x] `/admin/users` — liste users
- [x] `/admin/users/[id]` — édition user
- [x] `/admin/roles` — liste rôles
- [x] `/admin/roles/[id]` — édition rôle

**Actions**:
- [x] `update-user.ts` — modifier user
- [x] `create-user.ts` — créer user
- [ ] `send-invitation.ts` — **ENVOYER INVITATION** (manquant?)

**Composants**:
- [x] `InvitationCard.tsx` — accepter invitation ✅ NEW
- [x] `MembersView.tsx` — gestion membres (existe)
- [x] `PermissionsMatrix.tsx` — matrice rôles ✅ NEW
- [x] `OrganizationNameEditor.tsx` — renommer org ✅ NEW

---

## ❌ MANQUANT: Features À Implémenter

### 1. Envoi d'Invitations — CRITIQUE

**Manquant**:
- [ ] Endpoint POST `/api/auth/organization/invitations`
  - Validation: email, role
  - Garde: user est owner/admin
  - Crée `OrganizationInvitation` avec token 6h
  - Envoie email via Resend

**Lié**:
- [ ] Action `send-invitation.ts` (ou dans le composant)
- [ ] Email template pour invitation
- [ ] Gestion erreur (déjà membre, email invalide)

**Impact**: Sans ça, invitations ne peuvent pas être **créées**, seulement acceptées

---

### 2. Tests Automatisés — IMPORTANT

**Manquant** (5 suites):
- [ ] `test/api/video-projects.test.ts`
  - loadPreviews() SQL query
  - GET /api/video-projects avec pagination
  - CRUD (create, read, update, delete)
  - Permissions (can create, can delete)
  
- [ ] `test/api/invitations.test.ts`
  - POST /api/organization/invitations (envoyer)
  - GET /api/organization/invitations/[id] (détails)
  - POST /api/organization/invitations/[id]/accept
  - Edge cases: expired, email-mismatch, not-verified

- [ ] `test/actions/users.test.ts`
  - update-user avec gardes RBAC
  - create-user avec gardes RBAC
  - Check permissions (hasPermission)

- [ ] `test/actions/roles.test.ts`
  - Assigner rôle
  - Vérifier hiérarchie (pas promotion au-dessus)
  - Vérifier Super Admin read-only

- [ ] `test/lib/rbac.test.ts`
  - Résoudre permissions
  - Check permissions
  - Hiérarchie rôles

---

### 3. Gestion Complète des Membres — IMPORTANT

**Manquant** (depuis MembersView):
- [ ] Ajouter membre (invitation)
  - Endpoint POST `/api/auth/organization/invitations`
  - UI: formulaire + envoi email
  - Fallback: "Copy link" button

- [ ] Changer rôle membre
  - Endpoint PATCH `/api/organizations/[id]/members/[userId]` (?)
  - Garde: pas soi-même, pas promotion au-dessus
  - UI: dropdown rôle

- [ ] Retirer membre
  - Endpoint DELETE `/api/organizations/[id]/members/[userId]` (?)
  - Garde: au moins un owner
  - UI: bouton "Remove"

- [ ] Quitter organisation
  - Action `leave-organization.ts`
  - Garde: pas dernier owner
  - Redirect `/workspace` après

- [ ] Lister membres + invitations
  - MembersView.tsx existe, vérifie si complet

---

### 4. Verrous Projets (Lock/Unlock) — MOYEN

**Existe**:
- [x] POST `/api/video-projects/[id]/lock`
- [x] DELETE `/api/video-projects/[id]/lock`

**Manquant**:
- [ ] Badge UI "X is editing" dans workspace
  - Afficher `lockedByName` (remplace l'id)
  - Ajouter hook pour poll lock status

- [ ] Banneau "Read-only" dans storyboard
  - Affiche `lockedByName` (au lieu de l'id actuellement)
  - Message: "X is editing, changes are read-only"

---

### 5. Admin Pages Complètes — MOYEN

**Existe**:
- [x] `/admin/users` — liste
- [x] `/admin/users/[id]` — édition
- [x] `/admin/roles` — liste + matrice ✅ NEW
- [x] `/admin/roles/[id]` — édition + matrice ✅ NEW
- [x] `/admin/organizations` — permission check ✅ NEW

**Manquant**:
- [ ] Sidebar admin — filtrer liens par rôle
  - Exemple: custom role sans "role:update" ne voit pas page rôles
  - Implémenter permission check dans sidebar

- [ ] Page `/admin/permissions` — lister toutes permissions
  - Lecture seule pour référence

---

### 6. Autres

**Manquant/À Vérifier**:
- [ ] Doublon: `organization-manager.tsx` (admin) vs MembersView (studio)
  - Investiguer et décider lequel garder
  - Possiblement supprimer un des deux

- [ ] Message erreur "Email not verified" 
  - **CODE PRÊT** ✅ dans InvitationCard.tsx
  - Juste besoin de tester

- [ ] Lien "Sign out" si mauvais compte
  - **CODE PRÊT** ✅ dans InvitationCard.tsx
  - Juste besoin que `/logout` existe

---

## 📋 Priorité d'Implémentation

### 🔴 URGENT (Bloquant)
1. **Endpoint POST `/api/organization/invitations`** — envoyer invitations
   - Sans ça, les invitations sont inutiles
   - 30-60 min

2. **Déboguer gel navigateur `/workspace`**
   - Bloque tous les tests manuels
   - 30-60 min

### 🟡 IMPORTANT (Core Features)
3. **Gestion complète membres** (add/remove/role/leave)
   - Endpoints + UI dans MembersView
   - 1-2h

4. **Tests automatisés** (5 suites)
   - Valider RBAC, invitations, CRUD
   - 2-3h

### 🟢 NICE-TO-HAVE (UX Polish)
5. **Badge "X is editing"** dans workspace
   - UI improvement
   - 30 min

6. **Sidebar admin** — filtrer par rôle
   - UX improvement
   - 30 min

7. **Cleanup** — doublon components
   - Technique debt
   - 30 min

---

## 🎯 Plan d'Action Recommandé

**Phase 1: Unblock (1-2h)**
```
1. Déboguer /workspace freeze
2. Implémenter POST /api/organization/invitations
```

**Phase 2: Core Features (2-3h)**
```
3. Compléter gestion membres (endpoints + UI)
4. Tester manuellement toutes les features
```

**Phase 3: Quality (2-3h)**
```
5. Tests automatisés (5 suites)
6. Polish UI (badges, sidebar)
7. Cleanup techniques
```

---

## Checklist Implémentation

### Endpoint Invitations
- [ ] POST `/api/auth/organization/invitations`
  - [ ] Zod validation (email, role)
  - [ ] Guard: user est owner/admin
  - [ ] Créer `OrganizationInvitation` (6h expiry)
  - [ ] Envoyer email Resend
  - [ ] Retourner {id, email, role}

### Gestion Membres Endpoints
- [ ] PATCH `/api/organizations/[id]/members/[userId]` — changer rôle
- [ ] DELETE `/api/organizations/[id]/members/[userId]` — retirer
- [ ] POST `/api/organizations/[id]/leave` — quitter (action?)
- [ ] GET `/api/organizations/[id]/members` — lister (existe?)

### Tests Automatisés
- [ ] `test/api/video-projects.test.ts` (5-10 tests)
- [ ] `test/api/invitations.test.ts` (10-15 tests)
- [ ] `test/actions/users.test.ts` (5 tests)
- [ ] `test/actions/roles.test.ts` (5 tests)
- [ ] `test/lib/rbac.test.ts` (10 tests)

### UI/UX
- [ ] Badge "X is editing" dans ProjectCard
- [ ] Banneau read-only dans storyboard (utiliser lockedByName)
- [ ] Sidebar admin — permission check

### Cleanup
- [ ] Enquête: organization-manager.tsx vs MembersView
- [ ] Supprimer doublon si confirmé
