# Tests Manuels — Workspace, Organisations, RBAC

État: 2026-09-14

## Tests Complétés ✅

- [x] `/` — Page d'accueil affiche "Welcome to Studio" + 2 boutons (New Project, Workspace)
- [x] `/workspace` — Navigation depuis la page d'accueil
- [x] Authentification — Utilisateur connecté (pas de redirection login)
- [x] Sidebar — "New project", "Projects" (actif), "Members", "Organization" (Loading)
- [x] Barre de recherche — Présente en haut à droite
- [x] Bouton "+ New project" — Visible en haut à droite

## Tests en Cours ⚠️

- [ ] Chargement de la liste des projets — **BLOQUÉ**: Le rendu du navigateur a gelé pendant le chargement
  - Les squelettes sont visibles, mais les données ne se chargent pas
  - À investiguer: Requête API `/api/video-projects`, performance de la base, ou problème React

## Tests Restants ❌

### Workspace Projects
- [ ] Affichage des vignettes (16:9, 9:16, sans image)
- [ ] Recherche des projets
- [ ] Pagination
- [ ] Renommer un projet
- [ ] Supprimer un projet
- [ ] Badge "X is editing"

### New Project
- [ ] Sélection des 3 formats (16:9, 9:16, carré)
- [ ] Création d'un projet
- [ ] Redirection vers le storyboard

### Première connexion / Organisation personnelle
- [ ] Nouvel utilisateur sans organisation
- [ ] Création auto de "User's workspace"
- [ ] Ouverture du storyboard

### Sélecteur d'organisation
- [ ] Changer d'organisation
- [ ] Créer une organisation
- [ ] Rechargement de la liste des projets

### Invitations
- [ ] Page Membres — Formulaire d'invitation
- [ ] Envoi d'email (nécessite `SMTP_*` configurés)
- [ ] Lien de secours "Copy link"
- [ ] `/invite/[id]` — Non connecté → Login → Retour
- [ ] `/invite/[id]` — Mauvais compte
- [ ] `/invite/[id]` — Lien expiré
- [ ] `/invite/[id]` — Refus d'invitation

### Membres
- [ ] Affichage de la liste des membres
- [ ] Changement de rôle
- [ ] Retrait d'un membre
- [ ] Dernier owner bloqué
- [ ] Quitter l'organisation

### Admin — Rôles & Permissions
- [ ] `/users/[id]` — Assigner un rôle
- [ ] Champs désactivés sur soi-même
- [ ] `/roles/[id]` Super Admin — Cases désactivées
- [ ] Sidebar admin — Filtrage selon rôle

## Problèmes Découverts

### Critique 🔴
1. **Chargement des projets gelé** — Le navigateur ne peut pas rendre les données des projets
   - Symptôme: Squelettes visibles, mais page non-responsif
   - À vérifier: `app/api/video-projects/route.ts`, performance requête, erreur API

### Connu (du doc next-steps.md)
- [ ] Lecture seule du storyboard — affiche l'id au lieu du nom
- [ ] `/organizations` (admin) — n'a pas de check permissions
- [ ] better-auth e-mail vérifié — message pas clair
- [ ] Orga personnelle — pas de possibilité de renommer depuis le studio
- [ ] Tests auto manquants
- [ ] Pages admin (rôles) — UX basique

## Next Steps

1. **Investiguer le freeze du navigateur** — Vérifier les logs API, la base de données, la performance de la requête
2. **Continuer les tests manuels** — Une fois le chargement des projets réparé
3. **Fixer les problèmes connus** — Priorité basse (UX, messages)
4. **Tests automatisés** — Ajouter si le temps permet
