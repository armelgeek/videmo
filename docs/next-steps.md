# Suite — workspace, organisations, rôles

État au 2026-09-14.

## Où on en est

3 commits **locaux sur `main`, non poussés** :

- `c35d89d` feat(workspace) — liste de projets réelle avec aperçu, organisation personnelle auto
- `a058b06` feat(organization) — invitations et gestion des membres depuis le studio
- `0d3ab8d` fix(rbac) — élévation de privilèges bloquée, attribution des rôles réparée

Hors de ces commits, non touchés : `lib/whiteboard-animation/components/clip-selector-bar.tsx`, `whiteboard-editor-step.tsx`, `hooks/use-whiteboard-renderer.ts` (modifs antérieures).

`npm run setup:permissions` a été lancé sur la base locale (24 permissions).

## 1. Livrer (prochaine étape)

- [ ] `git switch -c feature/workspace-organizations-rbac` depuis `main`, puis `git push -u origin feature/workspace-organizations-rbac`
- [ ] Ouvrir la PR vers `main` (le CLAUDE.md impose une PR)
- [ ] Remettre `main` local sur `origin/main` une fois la branche poussée
- [ ] En prod après merge : `npx prisma migrate deploy` (rien de nouveau) puis `npm run setup:permissions`

## 2. Diagrammes PlantUML (exigés par le CLAUDE.md)

- [ ] `docs/features/workspace-projects.puml` — liste + aperçu SQL, création avec format, organisation personnelle
- [ ] `docs/organization/invitations.puml` — invitation, e-mail, `/invite/[id]` (non connecté, mauvais compte, expirée), acceptation
- [ ] `docs/auth/rbac-role-assignment.puml` — attribution de rôle, refus (soi-même, sans `role:update`, Super Admin)
- [ ] `scripts/puml check` sur chacun

## 3. Tests manuels navigateur (rien n'a été testé en vrai)

- [ ] `/workspace` : vignettes (16:9, 9:16, projet sans image), recherche, pagination, renommer, supprimer, badge « X is editing »
- [ ] `/new-project` : les 3 formats, redirection vers le storyboard
- [ ] Nouvel utilisateur sans organisation : organisation personnelle créée, storyboard qui s'ouvre
- [ ] Sélecteur d'organisation : changer, créer, rechargement de la liste et des récents
- [ ] Invitation de bout en bout — **configurer `SMTP_*`** sinon l'envoi échoue (le bouton « copier le lien » sert de secours)
- [ ] `/invite/[id]` : non connecté → login → retour ; mauvais compte ; lien expiré ; refus
- [ ] Page Membres : changer un rôle, retirer, dernier owner bloqué, quitter
- [ ] Admin `/users/[id]` : attribuer un rôle à quelqu'un d'autre ; champs désactivés sur soi-même
- [ ] Admin `/roles/[id]` Super Admin : cases désactivées, seule la description se modifie
- [ ] Sidebar admin : liens filtrés selon les permissions d'un rôle personnalisé

## 4. Reste à faire / connu

- [ ] **Bandeau lecture seule du storyboard** affiche l'id de l'éditeur au lieu de son nom (`use-project-sync.ts` lit `lockedBy` du 409 ; `session.ts` `toErrorResponse` renvoie l'id) → renvoyer le nom
- [ ] **`/organizations` (admin)** ne vérifie pas les permissions `organization:*` (seulement `requireAdmin`)
- [ ] better-auth exige un **e-mail vérifié** pour accepter une invitation : vérifier que le message affiché est clair dans ce cas
- [ ] Organisation personnelle nommée « X's workspace » : permettre de la renommer depuis le studio
- [ ] Tests automatisés manquants : requête d'aperçu (`app/api/video-projects/route.ts`), actions `update-user` / `create-user` avec les nouveaux gardes
- [ ] Pages admin rôles/permissions : UX basique (liste de cases) — envisager une matrice ressource × action
- [ ] `components/templates/organization-manager.tsx` (admin) fait doublon avec la page Membres du studio : décider lequel garder

## Décisions prises (à ne pas remettre en cause)

- Les organisations restent : chaque projet vidéo appartient à une organisation.
- Rôles globaux : un rôle ne s'applique que si `isAdmin` est actif ; Super Admin a tout implicitement ; personne ne modifie son propre rôle.
- Règles des rôles centralisées dans `lib/rbac.ts` (testées) — voir `lib/PERMISSIONS.md`.
