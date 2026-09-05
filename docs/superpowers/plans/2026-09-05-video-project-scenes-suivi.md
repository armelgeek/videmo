# Chantier VideoProject — suivi après livraison

Écrit à la clôture de l'exécution du plan
`docs/superpowers/plans/2026-09-05-video-project-scenes.md`.
Spec : `docs/superpowers/specs/2026-09-05-video-project-scenes-design.md`.

## Vérifications manuelles jamais faites

Aucune n'a été exécutée : les implémenteurs n'avaient pas le droit de démarrer un
serveur. Le comportement est couvert par 391 tests et par les relectures, mais
n'a pas été observé en conditions réelles.

- [ ] `curl -i http://localhost:3000/api/clips/<clipId>/annotations` sans cookie → `401`.
      **Bloqué** : plus aucun `TimelineClip` n'existe et rien n'en crée (ni route, ni
      seed, ni écran). Il faut insérer une ligne à la main pour observer ce cas.
- [ ] `PATCH /api/video-projects/<id>` sans bail → `409`.
- [ ] `PATCH` portant une `data:` URL dans une image de panneau → `400`.
- [ ] Séquence du bail à deux navigateurs : A prend (200), B refusé (409), A modifie
      (200), B refusé (409), A relâche (200), B prend (200).
      **Ne teste pas le cas d'I1** : il faut que le bail de A expire pendant qu'il
      tape, ce qu'un essai manuel ne produit pas par hasard.
- [ ] Parcours `/projects` : état vide, création, renommage (deux fois de suite, pour
      vérifier que le bail est bien relâché), suppression, badge « en cours d'édition
      par X », entrées *Renommer* et *Supprimer* masquées pour un rôle sans permission.
      L'écran n'a aucun lien de navigation : y aller par l'URL.

## Dette connue, par ordre d'urgence

1. **`requireRole` et `requireProjectAccess` portent la même doctrine 404/403 dans deux
   implémentations distinctes** (`app/api/video-projects/route.ts` et
   `lib/video-project/repository.ts`). Elles s'accordent aujourd'hui, rien ne le teste,
   et elles divergeront à la première condition ajoutée d'un seul côté. À traiter
   **avant** que le chantier 3 n'ajoute des routes qui choisiraient l'une ou l'autre.
   Forme propre : un `requireOrganizationRole(viewer, action)` que `requireProjectAccess`
   appelle après avoir chargé le projet.
2. **Un audio téléversé est perdu sans avertissement.** `whiteboardConfig.audio.url` est
   normalisée à `null` au lieu d'être rejetée (voir la spec, « Le piège de l'audio ») :
   l'enregistrement réussit et la piste disparaît au rechargement. Le chantier 1
   (stockage objet) supprime ce cas. En attendant, un avertissement dans l'interface
   serait honnête. Aucun test au niveau route ne couvre ce comportement.
3. **`count === 0` sur `POST .../lock` et sur le `PATCH`** relit le porteur sans filtrer
   `deletedAt` : un projet supprimé dans la fenêtre de course rend `409` au lieu de `404`.
4. **Pagination de `/projects`** : le pied de pagination disparaît à chaque changement de
   page (le skeleton remplace toute la vue), l'état vide clignote sur une page devenue
   vide, et un projet renommé remonte en tête de tri donc disparaît de la page où on
   le lisait.
5. **`catch {}` autour de `releaseLock`** (`lib/video-project/rename.ts`) : aucune trace.
   Un `console.warn` rendrait un bail fantôme diagnosticable.
6. **`persistedAudioTrackSchema` déclare optionnels** `id`, `source`, `volume`, `muted`,
   `offsetMs`, requis dans `AudioTrack`. Nécessaire pour les lignes déjà écrites, mais un
   consommateur qui typerait la piste relue en `AudioTrack` mentirait. À reprendre au
   chantier de réhydratation.
7. Mineurs sans urgence : `POST /api/video-projects` renvoie `lockedById` brut là où le
   `GET` renvoie un objet `lock` ; duplication du traitement `ZodError` dans les routes
   d'annotations, déjà couvert par `toErrorResponse` ; message d'échec unique sur la prise
   de bail dans `rename.ts` ; `window.confirm()` natif pour la suppression ; trois lectures
   de la même ligne par `PATCH` ; `ListResponse.total` déclaré et jamais lu ; aucun lien de
   navigation vers `/projects`.

## Piège à ne pas répéter

Le commit `6a1bd65` avait traduit en anglais les commentaires SQL d'une migration **déjà
appliquée**, ce qui a cassé le checksum Prisma de la base de dev : `migrate dev` a proposé
un `reset` destructif. Un fichier de migration appliqué ne se réécrit plus, même pour un
commentaire.
