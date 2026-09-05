# Projet vidéo en base — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à un projet vidéo une existence en base, rattachée à une organisation, avec un bail d'édition et des clips qui ont enfin un propriétaire.

**Architecture:** Quatre modules purs sous `lib/video-project/` portent toute la décision — schémas Zod, bail, table de permissions, résolution d'accès — et se testent sans base ni requête HTTP. Les routes ne font que parser, appeler `requireProjectAccess`, écrire, répondre. Le bail est un bail court renouvelable dont l'expiration est une lecture, jamais une écriture.

**Tech Stack:** Next.js 16.1.6 (route handlers), TypeScript strict, Prisma + PostgreSQL, better-auth 1.4.18 (plugin `organization`), Zod, Vitest + jsdom, shadcn/ui, Biome.

**Spec:** `docs/superpowers/specs/2026-09-05-video-project-scenes-design.md`

## Global Constraints

- `LOCK_TTL_MS = 120_000`. Une seule déclaration, dans `lib/video-project/lock.ts` ; aucun autre fichier n'écrit `120000` ni `2 * 60 * 1000`.
- **Une organisation étrangère, un projet supprimé et un projet inexistant rendent tous `404`.** `403` est réservé au membre de l'organisation à qui l'action est refusée par son rôle. Distinguer plus finement révélerait l'existence de projets qu'on n'a pas le droit de voir.
- Les schémas existants de `lib/storyboard/schema.ts` (`projectParamsSchema`, `storyboardPanelSchema`, `workflowStepSchema`) sont **réutilisés par import**, jamais redéclarés.
- Aucune `data:` URL n'entre en base, à aucune profondeur d'aucun document.
- Le client Prisma s'importe depuis `@/lib/prisma` (motif du dépôt), pas `@/lib/db`.
- La session se lit avec `auth.api.getSession({ headers: await headers() })` (motif de `app/api/whiteboard/render/route.ts:36`).
- Fichiers en kebab-case, fonctions en camelCase. Commentaires : seulement quand le *pourquoi* n'est pas évident, jamais pour décrire ce que fait le code. Pas de blocs multi-lignes.
- Commits conventionnels (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). **Pas de trailer `Co-Authored-By`** (`CLAUDE.md`).
- Tests colocalisés en `*.test.ts` à côté de leur source (`vitest.config.ts` : `include: ["**/*.test.ts"]`, `globals: true`, mais les fichiers du dépôt importent explicitement depuis `vitest` — faire pareil).
- Commandes : `npx vitest run <chemin>` pour un fichier, `npm test` pour la suite, `npx tsc --noEmit` pour les types.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `lib/video-project/schema.ts` | Schémas Zod des quatre documents, valeurs par défaut, refus des `data:` URL |
| `lib/video-project/lock.ts` | État et transitions du bail, sans horloge interne |
| `lib/video-project/access.ts` | Table rôle × action |
| `lib/video-project/repository.ts` | `requireProjectAccess` — la seule frontière Prisma |
| `lib/video-project/errors.ts` | `ProjectNotFoundError`, `ProjectForbiddenError`, `ProjectLockedError` |
| `app/api/video-projects/route.ts` | `GET` (liste), `POST` (création) |
| `app/api/video-projects/[id]/route.ts` | `GET`, `PATCH`, `DELETE` |
| `app/api/video-projects/[id]/lock/route.ts` | `POST` (prendre/renouveler), `DELETE` (relâcher) |
| `app/(protected)/projects/page.tsx` | Liste, création, renommage, suppression |
| `prisma/schema.prisma` | `VideoProject`, `TimelineClip.videoProjectId` |
| `lib/auth.ts` | `accessControl` avec la ressource `project` |

---

## Tâche 1 : schémas et refus des `data:` URL

**Files:**
- Create: `lib/video-project/schema.ts`
- Create: `lib/video-project/errors.ts`
- Test: `lib/video-project/schema.test.ts`

**Interfaces:**
- Consumes: `projectParamsSchema`, `storyboardPanelSchema`, `workflowStepSchema` de `@/lib/storyboard/schema`.
- Produces: `videoProjectDocumentSchema`, `createVideoProjectSchema`, `listVideoProjectsSchema`, `updateVideoProjectSchema`, `assertNoDataUrl(value: unknown): void`, `DEFAULT_DOCUMENTS`, et les classes d'erreur `ProjectNotFoundError`, `ProjectForbiddenError`, `ProjectLockedError`.

- [ ] **Step 1: Écrire les erreurs typées**

`lib/video-project/errors.ts` :

```ts
export class ProjectNotFoundError extends Error {
  constructor() {
    super("Project not found");
    this.name = "ProjectNotFoundError";
  }
}

export class ProjectForbiddenError extends Error {
  constructor() {
    super("Forbidden");
    this.name = "ProjectForbiddenError";
  }
}

export class ProjectLockedError extends Error {
  constructor(
    readonly lockedById: string | null,
    readonly lockExpiresAt: Date | null,
  ) {
    super("Project is locked by another member");
    this.name = "ProjectLockedError";
  }
}

export class DataUrlRejectedError extends Error {
  constructor(readonly path: string) {
    super(`A data: URL is not accepted (at ${path})`);
    this.name = "DataUrlRejectedError";
  }
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

`lib/video-project/schema.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { DataUrlRejectedError } from "./errors";
import {
  assertNoDataUrl,
  createVideoProjectSchema,
  updateVideoProjectSchema,
} from "./schema";

describe("createVideoProjectSchema", () => {
  it("accepts a plain title", () => {
    expect(createVideoProjectSchema.parse({ title: "Ma vidéo" })).toEqual({
      title: "Ma vidéo",
    });
  });

  it("rejects an empty title", () => {
    expect(createVideoProjectSchema.safeParse({ title: "" }).success).toBe(false);
  });
});

describe("updateVideoProjectSchema", () => {
  it("accepts a partial patch with only a title", () => {
    const parsed = updateVideoProjectSchema.parse({ title: "Renommé" });
    expect(parsed).toEqual({ title: "Renommé" });
  });

  it("accepts a patch carrying only panels", () => {
    const panels = [
      {
        id: "p1",
        imageUrl: "https://example.test/a.png",
        prompt: "un chat",
        duration: 5,
        isGenerating: false,
      },
    ];
    expect(updateVideoProjectSchema.parse({ panels }).panels).toHaveLength(1);
  });

  it("rejects a malformed panel", () => {
    const result = updateVideoProjectSchema.safeParse({
      panels: [{ id: "p1" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown workflow step", () => {
    expect(updateVideoProjectSchema.safeParse({ step: "editor" }).success).toBe(
      false,
    );
  });
});

describe("assertNoDataUrl", () => {
  it("passes on a document with only http urls", () => {
    expect(() =>
      assertNoDataUrl({ panels: [{ imageUrl: "https://example.test/a.png" }] }),
    ).not.toThrow();
  });

  it("rejects a data: url nested in the whiteboard audio track", () => {
    const document = {
      whiteboardConfig: {
        audio: { name: "voix.mp3", url: "data:audio/mpeg;base64,AAAA" },
      },
    };
    expect(() => assertNoDataUrl(document)).toThrow(DataUrlRejectedError);
  });

  it("names the path of the offending value", () => {
    try {
      assertNoDataUrl({ panels: [{ imageUrl: "data:image/png;base64,AAAA" }] });
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as DataUrlRejectedError).path).toBe("panels.0.imageUrl");
    }
  });

  it("ignores a string that merely mentions data: in the middle", () => {
    expect(() => assertNoDataUrl({ note: "voir data:image plus bas" })).not.toThrow();
  });
});
```

- [ ] **Step 3: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run lib/video-project/schema.test.ts`
Expected: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 4: Écrire `schema.ts`**

```ts
import { z } from "zod";
import {
  projectParamsSchema,
  storyboardPanelSchema,
  workflowStepSchema,
} from "@/lib/storyboard/schema";
import { DataUrlRejectedError } from "./errors";

export const projectStatusSchema = z.enum(["draft", "ready", "archived"]);
export const aspectRatioSchema = z.enum(["16:9", "9:16", "1:1"]);

// Un objet et non une chaîne : le chantier 4 (historique) y ajoutera des
// métadonnées sans migration.
export const projectScriptSchema = z.object({ text: z.string().default("") });

export const persistedAudioTrackSchema = z.object({
  name: z.string(),
  durationMs: z.number().nonnegative(),
  url: z.string().nullable(),
});

export const whiteboardConfigSchema = z.object({
  animStyle: z.string(),
  handStyle: z.string(),
  canvasBg: z.string(),
  annotations: z.array(z.unknown()).default([]),
  annotationConfig: z.record(z.string(), z.unknown()).default({}),
  audio: persistedAudioTrackSchema.nullable().default(null),
  transcript: z.array(z.unknown()).default([]),
});

export const videoProjectDocumentSchema = z.object({
  params: projectParamsSchema,
  script: projectScriptSchema,
  panels: z.array(storyboardPanelSchema),
  whiteboardConfig: whiteboardConfigSchema,
});
export type VideoProjectDocument = z.infer<typeof videoProjectDocumentSchema>;

export const createVideoProjectSchema = z.object({
  title: z.string().min(1).max(255),
});

export const updateVideoProjectSchema = z
  .object({
    title: z.string().min(1).max(255),
    status: projectStatusSchema,
    step: workflowStepSchema,
    aspectRatio: aspectRatioSchema,
    params: projectParamsSchema,
    script: projectScriptSchema,
    panels: z.array(storyboardPanelSchema),
    whiteboardConfig: whiteboardConfigSchema,
  })
  .partial();
export type UpdateVideoProject = z.infer<typeof updateVideoProjectSchema>;

export const listVideoProjectsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().default(""),
});

export const DEFAULT_DOCUMENTS: VideoProjectDocument = {
  params: projectParamsSchema.parse({}),
  script: { text: "" },
  panels: [],
  whiteboardConfig: whiteboardConfigSchema.parse({
    animStyle: "chunkjump",
    handStyle: "custom1",
    canvasBg: "white",
  }),
};

/**
 * Le contenu binaire n'entre pas en base : il appartient au stockage objet du
 * chantier 1. Une narration en base64 pèse plusieurs mégaoctets et serait
 * réécrite à chaque sauvegarde.
 */
export function assertNoDataUrl(value: unknown, path = ""): void {
  if (typeof value === "string") {
    if (value.startsWith("data:")) throw new DataUrlRejectedError(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoDataUrl(item, path ? `${path}.${index}` : String(index)),
    );
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      assertNoDataUrl(nested, path ? `${path}.${key}` : key);
    }
  }
}
```

- [ ] **Step 5: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run lib/video-project/schema.test.ts`
Expected: PASS — 10 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/video-project/schema.ts lib/video-project/schema.test.ts lib/video-project/errors.ts
git commit -m "feat(video-project): valider les documents et refuser les data URL"
```

---

## Tâche 2 : le bail d'édition, en fonctions pures

**Files:**
- Create: `lib/video-project/lock.ts`
- Test: `lib/video-project/lock.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `LOCK_TTL_MS`, `LockState = "free" | "held-by-me" | "held-by-other"`, `LockableProject = { lockedById: string | null; lockExpiresAt: Date | null }`, `lockState(project, userId, now): LockState`, `acquireLock(project, userId, now): { lockedById: string; lockExpiresAt: Date } | null`, `releaseLock(project, userId): { lockedById: null; lockExpiresAt: null } | null`.

- [ ] **Step 1: Écrire les tests qui échouent**

`lib/video-project/lock.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { LOCK_TTL_MS, acquireLock, lockState, releaseLock } from "./lock";

const NOW = new Date("2026-09-05T10:00:00.000Z");
const inMs = (ms: number) => new Date(NOW.getTime() + ms);

describe("lockState", () => {
  it("is free when nobody holds it", () => {
    expect(lockState({ lockedById: null, lockExpiresAt: null }, "u1", NOW)).toBe(
      "free",
    );
  });

  it("is held-by-me when I hold a valid lease", () => {
    const project = { lockedById: "u1", lockExpiresAt: inMs(60_000) };
    expect(lockState(project, "u1", NOW)).toBe("held-by-me");
  });

  it("is held-by-other when someone else holds a valid lease", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(60_000) };
    expect(lockState(project, "u1", NOW)).toBe("held-by-other");
  });

  it("is free when someone else's lease has expired", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(-1) };
    expect(lockState(project, "u1", NOW)).toBe("free");
  });

  it("is free exactly at the expiry instant", () => {
    const project = { lockedById: "u2", lockExpiresAt: NOW };
    expect(lockState(project, "u1", NOW)).toBe("free");
  });

  it("is free when a holder is recorded without an expiry", () => {
    expect(lockState({ lockedById: "u2", lockExpiresAt: null }, "u1", NOW)).toBe(
      "free",
    );
  });
});

describe("acquireLock", () => {
  it("grants a free lock for the full ttl", () => {
    const granted = acquireLock({ lockedById: null, lockExpiresAt: null }, "u1", NOW);
    expect(granted).toEqual({
      lockedById: "u1",
      lockExpiresAt: inMs(LOCK_TTL_MS),
    });
  });

  it("renews my own lock", () => {
    const project = { lockedById: "u1", lockExpiresAt: inMs(10_000) };
    expect(acquireLock(project, "u1", NOW)?.lockExpiresAt).toEqual(inMs(LOCK_TTL_MS));
  });

  it("takes over an expired lock", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(-1) };
    expect(acquireLock(project, "u1", NOW)?.lockedById).toBe("u1");
  });

  it("refuses a lock held by someone else", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(60_000) };
    expect(acquireLock(project, "u1", NOW)).toBeNull();
  });
});

describe("releaseLock", () => {
  it("clears my own lock", () => {
    const project = { lockedById: "u1", lockExpiresAt: inMs(60_000) };
    expect(releaseLock(project, "u1")).toEqual({
      lockedById: null,
      lockExpiresAt: null,
    });
  });

  it("refuses to clear someone else's lock", () => {
    const project = { lockedById: "u2", lockExpiresAt: inMs(60_000) };
    expect(releaseLock(project, "u1")).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run lib/video-project/lock.test.ts`
Expected: FAIL — `Failed to resolve import "./lock"`.

- [ ] **Step 3: Écrire `lock.ts`**

```ts
export const LOCK_TTL_MS = 120_000;

export type LockState = "free" | "held-by-me" | "held-by-other";

export interface LockableProject {
  lockedById: string | null;
  lockExpiresAt: Date | null;
}

/**
 * L'expiration est une lecture, jamais une écriture : un bail périmé se lit
 * comme libre, donc aucune tâche de nettoyage n'est nécessaire.
 */
export function lockState(
  project: LockableProject,
  userId: string,
  now: Date,
): LockState {
  const { lockedById, lockExpiresAt } = project;
  if (!lockedById || !lockExpiresAt) return "free";
  if (lockExpiresAt.getTime() <= now.getTime()) return "free";
  return lockedById === userId ? "held-by-me" : "held-by-other";
}

export function acquireLock(
  project: LockableProject,
  userId: string,
  now: Date,
): { lockedById: string; lockExpiresAt: Date } | null {
  if (lockState(project, userId, now) === "held-by-other") return null;
  return {
    lockedById: userId,
    lockExpiresAt: new Date(now.getTime() + LOCK_TTL_MS),
  };
}

export function releaseLock(
  project: LockableProject,
  userId: string,
): { lockedById: null; lockExpiresAt: null } | null {
  if (project.lockedById !== userId) return null;
  return { lockedById: null, lockExpiresAt: null };
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run lib/video-project/lock.test.ts`
Expected: PASS — 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/video-project/lock.ts lib/video-project/lock.test.ts
git commit -m "feat(video-project): calculer l'etat du bail d'edition"
```

---

## Tâche 3 : permissions par rôle

**Files:**
- Create: `lib/video-project/access.ts`
- Test: `lib/video-project/access.test.ts`
- Modify: `lib/auth.ts:131-149` (le bloc `organization({ ... })`)

**Interfaces:**
- Consumes: rien.
- Produces: `ProjectAction = "create" | "read" | "update" | "delete"`, `OrganizationRole = "owner" | "admin" | "member"`, `canAct(role: string, action: ProjectAction): boolean`, `PROJECT_STATEMENTS`.

- [ ] **Step 1: Écrire les tests qui échouent**

`lib/video-project/access.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { type ProjectAction, canAct } from "./access";

const ACTIONS: ProjectAction[] = ["create", "read", "update", "delete"];

describe("canAct", () => {
  it("lets an owner do everything", () => {
    for (const action of ACTIONS) expect(canAct("owner", action)).toBe(true);
  });

  it("lets an admin do everything", () => {
    for (const action of ACTIONS) expect(canAct("admin", action)).toBe(true);
  });

  it("lets a member create, read and update", () => {
    expect(canAct("member", "create")).toBe(true);
    expect(canAct("member", "read")).toBe(true);
    expect(canAct("member", "update")).toBe(true);
  });

  it("refuses deletion to a member", () => {
    expect(canAct("member", "delete")).toBe(false);
  });

  it("refuses everything to an unknown role", () => {
    for (const action of ACTIONS) expect(canAct("guest", action)).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run lib/video-project/access.test.ts`
Expected: FAIL — `Failed to resolve import "./access"`.

- [ ] **Step 3: Écrire `access.ts`**

```ts
export type ProjectAction = "create" | "read" | "update" | "delete";
export type OrganizationRole = "owner" | "admin" | "member";

export const PROJECT_STATEMENTS = {
  project: ["create", "read", "update", "delete"],
} as const;

const ALLOWED: Record<OrganizationRole, readonly ProjectAction[]> = {
  owner: ["create", "read", "update", "delete"],
  admin: ["create", "read", "update", "delete"],
  member: ["create", "read", "update"],
};

export function canAct(role: string, action: ProjectAction): boolean {
  const allowed = ALLOWED[role as OrganizationRole];
  return allowed ? allowed.includes(action) : false;
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run lib/video-project/access.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 5: Déclarer la ressource `project` dans better-auth**

En haut de `lib/auth.ts`, ajouter aux imports :

```ts
import { createAccessControl } from "better-auth/plugins/access";
import {
  defaultStatements,
  adminAc,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";
import { PROJECT_STATEMENTS } from "./video-project/access";
```

Puis, avant `export const auth = betterAuth({` :

```ts
const statement = { ...defaultStatements, ...PROJECT_STATEMENTS } as const;
const ac = createAccessControl(statement);

// La table de référence reste canAct (testée) ; ces rôles l'exposent au client
// pour que l'interface masque ce qui est interdit sans dupliquer la règle.
const organizationRoles = {
  owner: ac.newRole({ ...ownerAc.statements, project: ["create", "read", "update", "delete"] }),
  admin: ac.newRole({ ...adminAc.statements, project: ["create", "read", "update", "delete"] }),
  member: ac.newRole({ ...memberAc.statements, project: ["create", "read", "update"] }),
};
```

Dans l'appel `organization({ ... })` de `lib/auth.ts:132`, ajouter **avant** la clé `schema` (sans toucher à `schema`) :

```ts
      ac,
      roles: organizationRoles,
```

- [ ] **Step 6: Vérifier que la configuration du plugin tient toujours**

Run: `npx vitest run lib/auth.organization.test.ts && npx tsc --noEmit`
Expected: PASS, et aucune erreur de type. Ce test existant vérifie les surcharges `modelName` : elles ne doivent pas avoir bougé.

- [ ] **Step 7: Commit**

```bash
git add lib/video-project/access.ts lib/video-project/access.test.ts lib/auth.ts
git commit -m "feat(video-project): declarer la ressource project et ses roles"
```

---

## Tâche 4 : migration du schéma

**Files:**
- Modify: `prisma/schema.prisma` (ajout de `VideoProject`, modification de `TimelineClip:318`, ajout de relations sur `Organization:242` et `User:15`)
- Create: `prisma/migrations/<timestamp>_add_video_project/migration.sql`

**Interfaces:**
- Consumes: rien.
- Produces: le modèle Prisma `VideoProject` avec les champs `id, organizationId, createdById, title, status, step, aspectRatio, params, script, panels, whiteboardConfig, schemaVersion, lockedById, lockExpiresAt, deletedAt, createdAt, updatedAt`, et `TimelineClip.videoProjectId: String`.

- [ ] **Step 1: Ajouter le modèle à `prisma/schema.prisma`**

À la fin du fichier :

```prisma
model VideoProject {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdById    String?
  createdBy      User?        @relation("VideoProjectsCreated", fields: [createdById], references: [id], onDelete: SetNull)

  title       String @db.VarChar(255)
  status      String @default("draft")
  step        String @default("prompt")
  aspectRatio String @default("16:9")

  params           Json
  script           Json
  panels           Json
  whiteboardConfig Json
  schemaVersion    Int  @default(1)

  lockedById    String?
  lockedBy      User?     @relation("VideoProjectsLocked", fields: [lockedById], references: [id], onDelete: SetNull)
  lockExpiresAt DateTime?

  clips TimelineClip[]

  deletedAt DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  @@index([organizationId, deletedAt, updatedAt])
  @@index([lockExpiresAt])
}
```

- [ ] **Step 2: Déclarer les relations inverses**

Dans `model Organization` (`prisma/schema.prisma:242`), ajouter la ligne :

```prisma
  videoProjects VideoProject[]
```

Dans `model User` (`prisma/schema.prisma:15`), ajouter :

```prisma
  videoProjectsCreated VideoProject[] @relation("VideoProjectsCreated")
  videoProjectsLocked  VideoProject[] @relation("VideoProjectsLocked")
```

Dans `model TimelineClip` (`prisma/schema.prisma:318`), ajouter après `id` :

```prisma
  videoProjectId String
  videoProject   VideoProject @relation(fields: [videoProjectId], references: [id], onDelete: Cascade)
```

et à la fin du modèle, à côté de `@@index([trackId])` :

```prisma
  @@index([videoProjectId])
```

- [ ] **Step 3: Générer la migration sans l'appliquer**

Run: `npx prisma migrate dev --create-only --name add_video_project`
Expected: un dossier `prisma/migrations/<timestamp>_add_video_project/` contenant `migration.sql`. Prisma avertit qu'ajouter une colonne obligatoire à `TimelineClip` échouera si la table n'est pas vide — c'est attendu, l'étape suivante le règle.

- [ ] **Step 4: Vider `TimelineClip` avant l'ajout de la colonne**

Ouvrir le `migration.sql` généré et insérer, **juste avant** le premier `ALTER TABLE "TimelineClip"** :

```sql
-- Ces lignes n'ont jamais eu de propriétaire : aucun écran ne les crée, il n'y
-- a donc rien à conserver. Annotation part en cascade.
DELETE FROM "TimelineClip";
```

Vérifier avant d'appliquer que la base visée ne contient pas de clips à conserver :

```bash
npx prisma db execute --stdin <<< 'SELECT count(*) FROM "TimelineClip";'
```

- [ ] **Step 5: Appliquer la migration**

Run: `npx prisma migrate dev && npx prisma generate`
Expected: la migration s'applique sans erreur, le client Prisma est régénéré.

- [ ] **Step 6: Vérifier que les types compilent**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): ajouter VideoProject et rattacher les clips au projet"
```

---

## Tâche 5 : résolution d'accès

**Files:**
- Create: `lib/video-project/repository.ts`
- Test: `lib/video-project/repository.test.ts`

**Interfaces:**
- Consumes: `canAct`, `ProjectAction` (tâche 3) ; `ProjectNotFoundError`, `ProjectForbiddenError` (tâche 1).
- Produces:
  - `interface ProjectAccessDeps { findProject(id): Promise<AccessibleProject | null>; findRole(organizationId, userId): Promise<string | null> }`
  - `type AccessibleProject = { id: string; organizationId: string; deletedAt: Date | null }`
  - `requireProjectAccess(projectId: string, viewer: { userId: string; organizationId: string | null }, action: ProjectAction, deps: ProjectAccessDeps): Promise<{ project: AccessibleProject; role: string }>`
  - `prismaProjectAccessDeps: ProjectAccessDeps`

- [ ] **Step 1: Écrire les tests qui échouent**

`lib/video-project/repository.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { ProjectForbiddenError, ProjectNotFoundError } from "./errors";
import { type ProjectAccessDeps, requireProjectAccess } from "./repository";

const PROJECT = { id: "p1", organizationId: "org-1", deletedAt: null };
const VIEWER = { userId: "u1", organizationId: "org-1" };

function deps(overrides: Partial<ProjectAccessDeps> = {}): ProjectAccessDeps {
  return {
    findProject: async () => PROJECT,
    findRole: async () => "member",
    ...overrides,
  };
}

describe("requireProjectAccess", () => {
  it("returns the project and the caller's role", async () => {
    const result = await requireProjectAccess("p1", VIEWER, "read", deps());
    expect(result).toEqual({ project: PROJECT, role: "member" });
  });

  it("throws NotFound when the project does not exist", async () => {
    await expect(
      requireProjectAccess("nope", VIEWER, "read", deps({ findProject: async () => null })),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound when the project is soft-deleted", async () => {
    const gone = { ...PROJECT, deletedAt: new Date() };
    await expect(
      requireProjectAccess("p1", VIEWER, "read", deps({ findProject: async () => gone })),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound — never Forbidden — for another organization's project", async () => {
    const foreign = { userId: "u1", organizationId: "org-2" };
    await expect(
      requireProjectAccess("p1", foreign, "read", deps()),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound when the caller has no active organization", async () => {
    await expect(
      requireProjectAccess("p1", { userId: "u1", organizationId: null }, "read", deps()),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws NotFound when the caller is not a member", async () => {
    await expect(
      requireProjectAccess("p1", VIEWER, "read", deps({ findRole: async () => null })),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it("throws Forbidden when the role forbids the action", async () => {
    await expect(
      requireProjectAccess("p1", VIEWER, "delete", deps()),
    ).rejects.toBeInstanceOf(ProjectForbiddenError);
  });

  it("allows an owner to delete", async () => {
    const result = await requireProjectAccess(
      "p1",
      VIEWER,
      "delete",
      deps({ findRole: async () => "owner" }),
    );
    expect(result.role).toBe("owner");
  });
});
```

- [ ] **Step 2: Lancer les tests, vérifier qu'ils échouent**

Run: `npx vitest run lib/video-project/repository.test.ts`
Expected: FAIL — `Failed to resolve import "./repository"`.

- [ ] **Step 3: Écrire `repository.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { type ProjectAction, canAct } from "./access";
import { ProjectForbiddenError, ProjectNotFoundError } from "./errors";

export interface AccessibleProject {
  id: string;
  organizationId: string;
  deletedAt: Date | null;
}

export interface ProjectAccessDeps {
  findProject(id: string): Promise<AccessibleProject | null>;
  findRole(organizationId: string, userId: string): Promise<string | null>;
}

export const prismaProjectAccessDeps: ProjectAccessDeps = {
  findProject: (id) =>
    prisma.videoProject.findUnique({
      where: { id },
      select: { id: true, organizationId: true, deletedAt: true },
    }),
  findRole: async (organizationId, userId) => {
    const member = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
      select: { role: true },
    });
    return member?.role ?? null;
  },
};

/**
 * Tout ce qui n'est pas « membre à qui son rôle refuse l'action » rend
 * NotFound : répondre Forbidden confirmerait l'existence d'un projet que
 * l'appelant n'a pas le droit de voir.
 */
export async function requireProjectAccess(
  projectId: string,
  viewer: { userId: string; organizationId: string | null },
  action: ProjectAction,
  deps: ProjectAccessDeps = prismaProjectAccessDeps,
): Promise<{ project: AccessibleProject; role: string }> {
  if (!viewer.organizationId) throw new ProjectNotFoundError();

  const project = await deps.findProject(projectId);
  if (!project || project.deletedAt) throw new ProjectNotFoundError();
  if (project.organizationId !== viewer.organizationId) {
    throw new ProjectNotFoundError();
  }

  const role = await deps.findRole(project.organizationId, viewer.userId);
  if (!role) throw new ProjectNotFoundError();
  if (!canAct(role, action)) throw new ProjectForbiddenError();

  return { project, role };
}
```

- [ ] **Step 4: Lancer les tests, vérifier qu'ils passent**

Run: `npx vitest run lib/video-project/repository.test.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/video-project/repository.ts lib/video-project/repository.test.ts
git commit -m "feat(video-project): resoudre l'acces a un projet par l'organisation active"
```

---

## Tâche 6 : liste et création

**Files:**
- Create: `app/api/video-projects/route.ts`
- Create: `lib/video-project/session.ts`
- Test: `lib/video-project/session.test.ts`

**Interfaces:**
- Consumes: `listVideoProjectsSchema`, `createVideoProjectSchema`, `DEFAULT_DOCUMENTS` (tâche 1) ; `lockState` (tâche 2) ; `canAct` (tâche 3) ; `prismaProjectAccessDeps` (tâche 5).
- Produces:
  - `lib/video-project/session.ts` : `requireViewer(): Promise<{ userId: string; organizationId: string | null }>` (lève `ProjectUnauthorizedError` sans session), `toErrorResponse(error: unknown): NextResponse`, `ProjectUnauthorizedError`.
  - `lib/video-project/list.ts` n'existe pas : la projection de liste vit dans la route.

- [ ] **Step 1: Écrire le test de traduction des erreurs**

`lib/video-project/session.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  ProjectForbiddenError,
  ProjectLockedError,
  ProjectNotFoundError,
  DataUrlRejectedError,
} from "./errors";
import { ProjectUnauthorizedError, toErrorResponse } from "./session";

describe("toErrorResponse", () => {
  it("maps a missing session to 401", () => {
    expect(toErrorResponse(new ProjectUnauthorizedError()).status).toBe(401);
  });

  it("maps a missing project to 404", () => {
    expect(toErrorResponse(new ProjectNotFoundError()).status).toBe(404);
  });

  it("maps a role refusal to 403", () => {
    expect(toErrorResponse(new ProjectForbiddenError()).status).toBe(403);
  });

  it("maps a lock held by another to 409", () => {
    const error = new ProjectLockedError("u2", new Date());
    expect(toErrorResponse(error).status).toBe(409);
  });

  it("maps a rejected data url to 400", () => {
    expect(toErrorResponse(new DataUrlRejectedError("panels.0.imageUrl")).status).toBe(
      400,
    );
  });

  it("maps anything else to 500", () => {
    expect(toErrorResponse(new Error("boom")).status).toBe(500);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier qu'il échoue**

Run: `npx vitest run lib/video-project/session.test.ts`
Expected: FAIL — `Failed to resolve import "./session"`.

- [ ] **Step 3: Écrire `session.ts`**

```ts
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveOrganization } from "@/lib/auth-organization";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import {
  DataUrlRejectedError,
  ProjectForbiddenError,
  ProjectLockedError,
  ProjectNotFoundError,
} from "./errors";

export class ProjectUnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "ProjectUnauthorizedError";
  }
}

export interface Viewer {
  userId: string;
  organizationId: string | null;
}

export async function requireViewer(): Promise<Viewer> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new ProjectUnauthorizedError();

  const organizationId = await resolveActiveOrganization(
    {
      id: session.session.id,
      userId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    },
    prismaOrganizationRepository,
  );

  return { userId: session.user.id, organizationId };
}

export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof ProjectUnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof ProjectNotFoundError) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  if (error instanceof ProjectForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (error instanceof ProjectLockedError) {
    return NextResponse.json(
      {
        error: "Project is being edited",
        lockedBy: error.lockedById,
        expiresAt: error.lockExpiresAt,
      },
      { status: 409 },
    );
  }
  if (error instanceof DataUrlRejectedError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: error.issues },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
```

- [ ] **Step 4: Lancer le test, vérifier qu'il passe**

Run: `npx vitest run lib/video-project/session.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 5: Écrire la route liste + création**

`app/api/video-projects/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canAct } from "@/lib/video-project/access";
import { ProjectForbiddenError, ProjectNotFoundError } from "@/lib/video-project/errors";
import { lockState } from "@/lib/video-project/lock";
import { prismaProjectAccessDeps } from "@/lib/video-project/repository";
import {
  DEFAULT_DOCUMENTS,
  createVideoProjectSchema,
  listVideoProjectsSchema,
} from "@/lib/video-project/schema";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

// Jamais les colonnes Json : un panels[] complet par ligne rendrait la liste
// inutilisable.
const LIST_SELECT = {
  id: true,
  title: true,
  status: true,
  step: true,
  aspectRatio: true,
  updatedAt: true,
  lockedById: true,
  lockExpiresAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

async function requireRole(viewer: { userId: string; organizationId: string | null }) {
  if (!viewer.organizationId) throw new ProjectNotFoundError();
  const role = await prismaProjectAccessDeps.findRole(
    viewer.organizationId,
    viewer.userId,
  );
  if (!role) throw new ProjectNotFoundError();
  return { organizationId: viewer.organizationId, role };
}

export async function GET(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const { organizationId, role } = await requireRole(viewer);
    if (!canAct(role, "read")) throw new ProjectForbiddenError();

    const { page, limit, search } = listVideoProjectsSchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const where = {
      organizationId,
      deletedAt: null,
      ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.videoProject.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.videoProject.count({ where }),
    ]);

    const now = new Date();
    const data = rows.map(({ lockedById, lockExpiresAt, ...rest }) => ({
      ...rest,
      lock: {
        state: lockState({ lockedById, lockExpiresAt }, viewer.userId, now),
        byId: lockedById,
        expiresAt: lockExpiresAt,
      },
    }));

    return NextResponse.json({
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const viewer = await requireViewer();
    const { organizationId, role } = await requireRole(viewer);
    if (!canAct(role, "create")) throw new ProjectForbiddenError();

    const { title } = createVideoProjectSchema.parse(await request.json());

    const project = await prisma.videoProject.create({
      data: {
        organizationId,
        createdById: viewer.userId,
        title,
        ...DEFAULT_DOCUMENTS,
      },
      select: LIST_SELECT,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 6: Vérifier types et suite**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur de type, toute la suite passe.

- [ ] **Step 7: Commit**

```bash
git add app/api/video-projects/route.ts lib/video-project/session.ts lib/video-project/session.test.ts
git commit -m "feat(video-project): lister et creer des projets par organisation"
```

---

## Tâche 7 : lecture, mise à jour, suppression

**Files:**
- Create: `app/api/video-projects/[id]/route.ts`

**Interfaces:**
- Consumes: `requireProjectAccess` (tâche 5), `lockState`/`acquireLock` (tâche 2), `updateVideoProjectSchema`/`assertNoDataUrl` (tâche 1), `requireViewer`/`toErrorResponse` (tâche 6).
- Produces: rien que les tâches suivantes consomment.

- [ ] **Step 1: Écrire la route**

`app/api/video-projects/[id]/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectLockedError, ProjectNotFoundError } from "@/lib/video-project/errors";
import { acquireLock, lockState } from "@/lib/video-project/lock";
import { requireProjectAccess } from "@/lib/video-project/repository";
import {
  assertNoDataUrl,
  updateVideoProjectSchema,
} from "@/lib/video-project/schema";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

const FULL_SELECT = {
  id: true,
  title: true,
  status: true,
  step: true,
  aspectRatio: true,
  params: true,
  script: true,
  panels: true,
  whiteboardConfig: true,
  schemaVersion: true,
  updatedAt: true,
  lockedById: true,
  lockExpiresAt: true,
  createdBy: { select: { id: true, name: true } },
} as const;

async function loadFull(id: string, userId: string) {
  const row = await prisma.videoProject.findUnique({
    where: { id },
    select: FULL_SELECT,
  });
  if (!row) throw new ProjectNotFoundError();

  const { lockedById, lockExpiresAt, ...rest } = row;
  return {
    ...rest,
    lock: {
      state: lockState({ lockedById, lockExpiresAt }, userId, new Date()),
      byId: lockedById,
      expiresAt: lockExpiresAt,
    },
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "read");
    return NextResponse.json(await loadFull(id, viewer.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "update");

    const patch = updateVideoProjectSchema.parse(await request.json());
    assertNoDataUrl(patch);

    const current = await prisma.videoProject.findUnique({
      where: { id },
      select: { lockedById: true, lockExpiresAt: true },
    });
    if (!current) throw new ProjectNotFoundError();

    const now = new Date();
    if (lockState(current, viewer.userId, now) !== "held-by-me") {
      throw new ProjectLockedError(current.lockedById, current.lockExpiresAt);
    }

    // Une frappe continue renouvelle le bail d'elle-même : le chantier 3 n'a
    // pas besoin d'un battement séparé tant que l'utilisateur écrit.
    const renewed = acquireLock(current, viewer.userId, now);

    await prisma.videoProject.update({
      where: { id },
      data: { ...patch, ...renewed },
    });

    return NextResponse.json(await loadFull(id, viewer.userId));
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "delete");

    const current = await prisma.videoProject.findUnique({
      where: { id },
      select: { lockedById: true, lockExpiresAt: true },
    });
    if (!current) throw new ProjectNotFoundError();

    if (lockState(current, viewer.userId, new Date()) === "held-by-other") {
      throw new ProjectLockedError(current.lockedById, current.lockExpiresAt);
    }

    await prisma.videoProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    // Un corps, et non 204 : apiCall (lib/client.ts:21) appelle toujours
    // response.json(), donc une réponse vide ferait échouer api.delete.
    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier à la main le refus sans bail**

Démarrer `npm run dev`, se connecter, créer un projet via `POST /api/video-projects`, puis :

```bash
curl -i -X PATCH http://localhost:3000/api/video-projects/<id> \
  -H 'Content-Type: application/json' -b <cookie de session> \
  -d '{"title":"Sans bail"}'
```

Expected: `409` avec `{"error":"Project is being edited","lockedBy":null,...}` — le bail n'a pas encore été pris.

- [ ] **Step 4: Vérifier le refus d'une `data:` URL**

```bash
curl -i -X PATCH http://localhost:3000/api/video-projects/<id> \
  -H 'Content-Type: application/json' -b <cookie de session> \
  -d '{"whiteboardConfig":{"animStyle":"chunkjump","handStyle":"custom1","canvasBg":"white","audio":{"name":"v","durationMs":1,"url":"data:audio/mpeg;base64,AA"}}}'
```

Expected: `400`, message citant le chemin `whiteboardConfig.audio.url`. (Le `409` du bail arrive après la validation : ce test reste valide sans bail.)

- [ ] **Step 5: Commit**

```bash
git add "app/api/video-projects/[id]/route.ts"
git commit -m "feat(video-project): lire, modifier et supprimer un projet"
```

---

## Tâche 8 : prendre et relâcher le bail

**Files:**
- Create: `app/api/video-projects/[id]/lock/route.ts`

**Interfaces:**
- Consumes: `requireProjectAccess` (tâche 5), `LOCK_TTL_MS`/`lockState` (tâche 2), `requireViewer`/`toErrorResponse` (tâche 6).
- Produces: rien que les tâches suivantes consomment.

- [ ] **Step 1: Écrire la route**

`app/api/video-projects/[id]/lock/route.ts` :

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectLockedError, ProjectNotFoundError } from "@/lib/video-project/errors";
import { LOCK_TTL_MS } from "@/lib/video-project/lock";
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "update");

    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    // La condition est dans le WHERE, pas dans une lecture préalable : deux
    // membres qui cliquent en même temps ne peuvent pas l'obtenir tous deux.
    const { count } = await prisma.videoProject.updateMany({
      where: {
        id,
        deletedAt: null,
        OR: [
          { lockedById: null },
          { lockedById: viewer.userId },
          { lockExpiresAt: null },
          { lockExpiresAt: { lte: now } },
        ],
      },
      data: { lockedById: viewer.userId, lockExpiresAt: expiresAt },
    });

    if (count === 0) {
      const holder = await prisma.videoProject.findUnique({
        where: { id },
        select: { lockedById: true, lockExpiresAt: true },
      });
      if (!holder) throw new ProjectNotFoundError();
      throw new ProjectLockedError(holder.lockedById, holder.lockExpiresAt);
    }

    return NextResponse.json({ lockedById: viewer.userId, expiresAt });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const viewer = await requireViewer();
    await requireProjectAccess(id, viewer, "update");

    await prisma.videoProject.updateMany({
      where: { id, lockedById: viewer.userId },
      data: { lockedById: null, lockExpiresAt: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
```

`DELETE` ne signale pas l'absence de bail : relâcher ce qu'on ne tient pas est un cas normal (fermeture d'onglet après expiration), pas une erreur.

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Vérifier à la main le cycle complet**

Avec le serveur de dev et deux sessions distinctes (deux navigateurs, deux membres de la même organisation) :

1. Session A : `POST /api/video-projects/<id>/lock` → `200`.
2. Session B : `POST /api/video-projects/<id>/lock` → `409` avec `lockedBy` = A.
3. Session A : `PATCH` avec `{"title":"Avec bail"}` → `200`.
4. Session B : même `PATCH` → `409`.
5. Session A : `DELETE .../lock` → `200`.
6. Session B : `POST .../lock` → `200`.

Expected: exactement ces codes.

- [ ] **Step 4: Commit**

```bash
git add "app/api/video-projects/[id]/lock/route.ts"
git commit -m "feat(video-project): prendre, renouveler et relacher le bail d'edition"
```

---

## Tâche 9 : fermer les routes d'annotations

**Files:**
- Modify: `app/api/clips/[clipId]/annotations/route.ts` (entier)
- Modify: `app/api/clips/[clipId]/annotations/[annotationId]/route.ts` (entier)

**Interfaces:**
- Consumes: `requireProjectAccess` (tâche 5), `requireViewer`/`toErrorResponse` (tâche 6), `TimelineClip.videoProjectId` (tâche 4).
- Produces: rien. La forme des réponses ne change pas.

- [ ] **Step 1: Vérifier l'état actuel**

Run: `grep -c "getSession" "app/api/clips/[clipId]/annotations/route.ts"`
Expected: `0` — la route ne vérifie aujourd'hui aucune session. C'est le trou que cette tâche ferme.

- [ ] **Step 2: Ajouter la garde dans `route.ts`**

Dans `app/api/clips/[clipId]/annotations/route.ts`, ajouter aux imports :

```ts
import { requireProjectAccess } from "@/lib/video-project/repository";
import { requireViewer, toErrorResponse } from "@/lib/video-project/session";
```

Dans `GET`, remplacer le bloc « Verify clip exists » par :

```ts
    const viewer = await requireViewer();
    const clip = await prisma.timelineClip.findUnique({
      where: { id: clipId },
      select: { videoProjectId: true },
    });
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }
    await requireProjectAccess(clip.videoProjectId, viewer, "read");
```

Dans `POST`, le même bloc, avec `"update"` au lieu de `"read"`, placé **avant** `CreateAnnotationSchema.parse`.

Dans les deux `catch`, remplacer la réponse `500` finale par :

```ts
    return toErrorResponse(error)
```

en gardant la branche `z.ZodError` existante au-dessus (elle reste plus précise que le cas générique).

- [ ] **Step 3: Appliquer la même garde à `[annotationId]/route.ts`**

Dans `app/api/clips/[clipId]/annotations/[annotationId]/route.ts`, pour chaque handler exporté (`PATCH`, `PUT`, `DELETE` — reprendre ceux réellement présents dans le fichier), insérer en tête du `try` :

```ts
    const viewer = await requireViewer();
    const clip = await prisma.timelineClip.findUnique({
      where: { id: clipId },
      select: { videoProjectId: true },
    });
    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 })
    }
    await requireProjectAccess(clip.videoProjectId, viewer, "update");
```

et remplacer la réponse `500` finale de chaque `catch` par `return toErrorResponse(error)`.

- [ ] **Step 4: Vérifier que rien n'appelle plus ces routes sans session**

Run: `npx tsc --noEmit && grep -rn "requireProjectAccess" "app/api/clips"`
Expected: aucune erreur de type, et une occurrence par handler exporté des deux fichiers.

- [ ] **Step 5: Vérifier à la main le refus anonyme**

```bash
curl -i http://localhost:3000/api/clips/<clipId>/annotations
```

Expected: `401` — sans cookie de session, plus aucune annotation ne sort.

- [ ] **Step 6: Commit**

```bash
git add "app/api/clips"
git commit -m "fix(annotations): exiger une session et l'appartenance a l'organisation"
```

---

## Tâche 10 : page de gestion des projets

**Files:**
- Create: `app/(protected)/projects/page.tsx`
- Create: `components/organisms/video-project-list.tsx`
- Create: `components/molecules/forms/video-project-dialog.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/video-projects`, `PATCH/DELETE /api/video-projects/[id]` (tâches 6 et 7) ; `api` de `@/lib/client` ; `toast` de `sonner`.
- Produces: rien.

- [ ] **Step 1: Écrire la boîte de dialogue de création/renommage**

`components/molecules/forms/video-project-dialog.tsx` — un composant client contrôlé, un seul champ `title`, deux modes distingués par la présence de `projectId` :

```tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  initialTitle?: string;
  onDone: () => void;
}

export function VideoProjectDialog({
  open,
  onOpenChange,
  projectId,
  initialTitle = "",
  onDone,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const res = projectId
        ? await api.patch(`/api/video-projects/${projectId}`, { title })
        : await api.post("/api/video-projects", { title });
      if (!res.ok) throw new Error(res.error);

      toast.success(projectId ? "Projet renommé" : "Projet créé");
      onOpenChange(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {projectId ? "Renommer le projet" : "Nouveau projet"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor="title">Titre</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={255}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || title.trim() === ""}>
              {projectId ? "Renommer" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Attention** : le renommage passe par `PATCH`, qui exige le bail. Prendre le bail avant, le relâcher après :

```ts
      if (projectId) {
        const taken = await api.post(`/api/video-projects/${projectId}/lock`, {});
        if (!taken.ok) throw new Error("Projet en cours d'édition par un autre membre");
      }
```

à insérer en tête du `try`, et après un renommage réussi :

```ts
      if (projectId) await api.delete(`/api/video-projects/${projectId}/lock`);
```

- [ ] **Step 2: Écrire la liste**

`components/organisms/video-project-list.tsx` :

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { VideoProjectDialog } from "@/components/molecules/forms/video-project-dialog";

interface ProjectRow {
  id: string;
  title: string;
  status: string;
  aspectRatio: string;
  updatedAt: string;
  createdBy: { id: string; name: string } | null;
  lock: { state: "free" | "held-by-me" | "held-by-other"; byId: string | null };
}

interface ListResponse {
  data: ProjectRow[];
  total: number;
}

export function VideoProjectList({ canDelete }: { canDelete: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ProjectRow | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<ListResponse>("/api/video-projects");
      if (!res.ok) throw new Error(res.error);
      setRows(res.data.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (project: ProjectRow) => {
    if (!confirm(`Supprimer « ${project.title} » ?`)) return;
    try {
      const res = await api.delete(`/api/video-projects/${project.id}`);
      if (!res.ok) throw new Error(res.error);
      toast.success("Projet supprimé");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible");
    }
  };

  if (isLoading) return <TableSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>Nouveau projet</Button>
      </div>

      {rows.length === 0 ? (
        <div className="border rounded-lg bg-card p-12 text-center">
          <p className="font-medium">Aucun projet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Créez-en un pour commencer une vidéo.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((project) => (
            <div key={project.id} className="border rounded-lg bg-card p-6 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-tight">{project.title}</h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Actions">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => router.push(`/storyboard?project=${project.id}`)}
                    >
                      Ouvrir
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setRenaming(project)}>
                      Renommer
                    </DropdownMenuItem>
                    {canDelete && (
                      <DropdownMenuItem onClick={() => handleDelete(project)}>
                        Supprimer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{project.status}</Badge>
                <Badge variant="outline">{project.aspectRatio}</Badge>
                {project.lock.state === "held-by-other" && (
                  <Badge variant="destructive">En cours d'édition</Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                {project.createdBy?.name ?? "Auteur inconnu"} —{" "}
                {new Date(project.updatedAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          ))}
        </div>
      )}

      <VideoProjectDialog
        open={creating}
        onOpenChange={setCreating}
        onDone={load}
      />
      {renaming && (
        <VideoProjectDialog
          open
          onOpenChange={(open) => !open && setRenaming(null)}
          projectId={renaming.id}
          initialTitle={renaming.title}
          onDone={load}
        />
      )}
    </div>
  );
}
```

Si `components/ui/badge.tsx` ou `dropdown-menu.tsx` manquent, les ajouter avec
`npx shadcn@latest add badge dropdown-menu` avant de continuer.

- [ ] **Step 3: Écrire la page**

`app/(protected)/projects/page.tsx` :

```tsx
import { requireAuth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { resolveActiveOrganization } from "@/lib/auth-organization";
import { prismaOrganizationRepository } from "@/lib/auth-organization-prisma";
import { canAct } from "@/lib/video-project/access";
import { VideoProjectList } from "@/components/organisms/video-project-list";

export default async function ProjectsPage() {
  const session = await requireAuth();

  const organizationId = await resolveActiveOrganization(
    {
      id: session.session.id,
      userId: session.user.id,
      activeOrganizationId: session.session.activeOrganizationId ?? null,
    },
    prismaOrganizationRepository,
  );

  const member = organizationId
    ? await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId, userId: session.user.id },
        },
        select: { role: true },
      })
    : null;

  if (!organizationId || !member) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Projets</h1>
        <p className="text-xs text-muted-foreground mt-2">
          Rejoignez une organisation pour créer des projets vidéo.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-lg font-semibold">Projets</h1>
      <VideoProjectList canDelete={canAct(member.role, "delete")} />
    </div>
  );
}
```

- [ ] **Step 4: Vérifier les types et la mise en forme**

Run: `npx tsc --noEmit && npm run format`
Expected: aucune erreur de type, Biome ne signale rien.

- [ ] **Step 5: Vérifier à la main le parcours complet**

Avec `npm run dev`, connecté comme `owner` :

1. `/projects` affiche l'état vide.
2. « Nouveau projet » crée un projet, qui apparaît dans la grille.
3. Renommer le change de nom sans erreur ; le bail est relâché (une seconde tentative de renommage réussit aussi).
4. Supprimer le fait disparaître ; il ne revient pas après rechargement.
5. Connecté comme `member` dans la même organisation : l'entrée *Supprimer* est absente, et un `DELETE` lancé à la main rend `403`.
6. Avec un second navigateur qui a pris le bail, la carte affiche « En cours d'édition ».

- [ ] **Step 6: Commit**

```bash
git add "app/(protected)/projects" components/organisms/video-project-list.tsx components/molecules/forms/video-project-dialog.tsx
git commit -m "feat(video-project): ajouter l'ecran de gestion des projets"
```

---

## Vérification finale

- [ ] `npx tsc --noEmit` — aucune erreur
- [ ] `npm test` — toute la suite passe
- [ ] `npm run lint` — aucune erreur
- [ ] `grep -rn "120000\|120_000" lib app --include=*.ts --include=*.tsx | grep -v node_modules` — une seule occurrence, dans `lib/video-project/lock.ts`
- [ ] `grep -rn "getSession" "app/api/clips"` — au moins une garde par fichier (via `requireViewer`)
- [ ] `curl -i http://localhost:3000/api/clips/<clipId>/annotations` sans cookie — `401`
- [ ] Un `GET /api/video-projects` ne renvoie ni `params`, ni `script`, ni `panels`, ni `whiteboardConfig`
- [ ] Les treize critères d'acceptation de la spec sont satisfaits

---

## Suite

Le chantier 3 (éditeur branché) remplace le `persist` `localStorage` de
`lib/storyboard/store.ts` par ces routes, lit le `?project=<id>` que la page
`/projects` produit déjà, et ajoute le renouvellement périodique du bail
(conseillé : toutes les 30 s, soit un quart de `LOCK_TTL_MS`). L'audio et les
images restent hors base jusqu'au chantier 1.
