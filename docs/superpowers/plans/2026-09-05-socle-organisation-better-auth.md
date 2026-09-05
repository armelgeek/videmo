# Socle organisation better-auth — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Brancher le plugin `organization` de better-auth sur les tables d'organisation existantes, pour que les projets vidéo puissent s'y rattacher au chantier suivant.

**Architecture:** Le plugin pointe sur les modèles Prisma actuels via des surcharges `modelName` et `fields` — aucune table n'est renommée, aucune donnée d'organisation ou de membre n'est déplacée. `Organization.ownerId` est remplacé par le membre de rôle `owner`, après remplissage dans la même migration. La seule vraie logique du chantier, le choix de l'organisation active, est isolée en fonctions pures testables sans base.

**Tech Stack:** better-auth 1.4.18 (`organization` plugin), Prisma + PostgreSQL, Next.js 16, Vitest, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-09-05-socle-organisation-better-auth-design.md`

## Global Constraints

- `better-auth@^1.4.18` — déjà installé, ne pas changer la version.
- Fichiers en kebab-case, fonctions en camelCase (`CLAUDE.md`).
- Commentaires : uniquement quand le *pourquoi* n'est pas évident, jamais pour décrire ce que fait le code. Pas de blocs multi-lignes.
- Commits conventionnels (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). **Pas de trailer `Co-Authored-By`** dans les commits (`CLAUDE.md`).
- Les tests vivent à côté de leur source, en `*.test.ts` (motif `vitest.config.ts`).
- Suite de tests : `npm test` (`vitest run`). Typage : `npx tsc --noEmit`.
- Aucune table renommée. `joinedAt` garde son nom.
- Le schéma des modèles du plugin fait foi. Comme on surcharge `modelName` pour viser les tables existantes, la sortie brute de `npx @better-auth/cli generate` n'est **pas** utilisable telle quelle : elle sert de contrôle croisé sur la liste des champs (tâche 3, étape 3 bis), pas de source.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `lib/auth-organisation.ts` *(créé)* | Choix et résolution de l'organisation active. Aucune dépendance à Prisma ni à better-auth. | 1, 2 |
| `lib/auth-organisation.test.ts` *(créé)* | Tests des deux fonctions ci-dessus. | 1, 2 |
| `prisma/schema.prisma` *(modifié)* | `Session.activeOrganizationId`, retrait de `ownerId`, nouvelle forme d'`OrganizationInvitation`. | 3 |
| `prisma/migrations/*/migration.sql` *(créé)* | Migration écrite à la main pour garantir l'ordre remplissage → suppression. | 3 |
| `scripts/verifier-organisations.ts` *(créé)* | Contrôle post-migration : chaque organisation a au moins un `owner`. | 3 |
| `lib/auth.ts` *(modifié)* | Déclare le plugin `organization` et le hook de session. | 4 |
| `lib/auth.organisation.test.ts` *(créé)* | Assère que les surcharges pointent sur les bons modèles et champs. | 4 |
| `lib/auth-client.ts` *(modifié)* | Déclare `organizationClient()`. | 5 |
| `components/templates/organization-manager.tsx` *(modifié)* | Passe sur `authClient.organization.*`. | 5 |
| `app/api/organizations/**` *(supprimé)* | Remplacé par les points d'entrée du plugin. | 5 |

---

## Tâche 1 : choisir l'organisation active

**Files:**
- Create: `lib/auth-organisation.ts`
- Test: `lib/auth-organisation.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `interface AppartenanceOrganisation { organizationId: string; joinedAt: Date }`
  - `function choisirOrganisationActive(appartenances: AppartenanceOrganisation[]): string | null`

**Contexte pour l'implémenteur.** Un utilisateur peut appartenir à zéro, une ou
plusieurs organisations. À la connexion il faut en désigner une comme
« active ». La règle retenue par la spec : la plus récemment rejointe. La
fonction est volontairement pure — pas d'accès base, pas de session — pour être
testable en isolation.

- [ ] **Étape 1 : écrire les tests qui échouent**

Créer `lib/auth-organisation.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  choisirOrganisationActive,
  type AppartenanceOrganisation,
} from "./auth-organisation";

const le = (jour: number): Date => new Date(`2026-01-${String(jour).padStart(2, "0")}T00:00:00Z`);

describe("choisirOrganisationActive", () => {
  it("rend null quand l'utilisateur n'appartient a aucune organisation", () => {
    expect(choisirOrganisationActive([])).toBeNull();
  });

  it("rend la seule organisation quand il n'y en a qu'une", () => {
    const une: AppartenanceOrganisation[] = [{ organizationId: "org-1", joinedAt: le(3) }];
    expect(choisirOrganisationActive(une)).toBe("org-1");
  });

  it("rend la plus recemment rejointe quand il y en a plusieurs", () => {
    const plusieurs: AppartenanceOrganisation[] = [
      { organizationId: "org-ancienne", joinedAt: le(1) },
      { organizationId: "org-recente", joinedAt: le(9) },
      { organizationId: "org-moyenne", joinedAt: le(5) },
    ];
    expect(choisirOrganisationActive(plusieurs)).toBe("org-recente");
  });

  it("ne modifie pas le tableau recu", () => {
    // L'appelant est un hook de session : muter son entree ferait porter un
    // effet de bord a une fonction de decision.
    const source: AppartenanceOrganisation[] = [
      { organizationId: "org-a", joinedAt: le(1) },
      { organizationId: "org-b", joinedAt: le(2) },
    ];
    const copie = [...source];
    choisirOrganisationActive(source);
    expect(source).toEqual(copie);
  });

  it("departage deux appartenances de meme date sans planter", () => {
    const exAequo: AppartenanceOrganisation[] = [
      { organizationId: "org-a", joinedAt: le(4) },
      { organizationId: "org-b", joinedAt: le(4) },
    ];
    expect(["org-a", "org-b"]).toContain(choisirOrganisationActive(exAequo));
  });
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run lib/auth-organisation.test.ts`
Expected: FAIL — `Cannot find module './auth-organisation'`

- [ ] **Étape 3 : écrire l'implémentation minimale**

Créer `lib/auth-organisation.ts` :

```ts
export interface AppartenanceOrganisation {
  organizationId: string;
  joinedAt: Date;
}

/**
 * L'organisation active a la connexion : la plus recemment rejointe.
 *
 * Le tri porte sur une COPIE : cette fonction est appelee depuis un hook de
 * session, qui lui passe la liste qu'il vient de lire.
 */
export function choisirOrganisationActive(
  appartenances: AppartenanceOrganisation[],
): string | null {
  if (appartenances.length === 0) return null;

  const [plusRecente] = [...appartenances].sort(
    (a, b) => b.joinedAt.getTime() - a.joinedAt.getTime(),
  );
  return plusRecente.organizationId;
}
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Run: `npx vitest run lib/auth-organisation.test.ts`
Expected: PASS — 5 tests

- [ ] **Étape 5 : commit**

```bash
git add lib/auth-organisation.ts lib/auth-organisation.test.ts
git commit -m "feat(auth): choisir l'organisation active d'un utilisateur"
```

---

## Tâche 2 : résolution paresseuse pour les sessions antérieures

**Files:**
- Modify: `lib/auth-organisation.ts`
- Test: `lib/auth-organisation.test.ts`

**Interfaces:**
- Consumes: `choisirOrganisationActive`, `AppartenanceOrganisation` (tâche 1).
- Produces:
  - `interface DepotOrganisation { listerAppartenances(userId: string): Promise<AppartenanceOrganisation[]>; ecrireOrganisationActive(sessionId: string, organizationId: string): Promise<void> }`
  - `function resoudreOrganisationActive(session: { id: string; userId: string; activeOrganizationId: string | null }, depot: DepotOrganisation): Promise<string | null>`

**Contexte pour l'implémenteur.** Le hook de session ne s'applique qu'aux
*nouvelles* connexions. Les sessions déjà ouvertes au moment de la migration
auront `activeOrganizationId` à `null`. Plutôt que de déconnecter tout le monde,
on résout à la demande : à la première lecture qui trouve `null`, on choisit et
on écrit. Le dépôt est passé en paramètre — pas importé — pour que la fonction
se teste sans base.

- [ ] **Étape 1 : écrire les tests qui échouent**

Ajouter à `lib/auth-organisation.test.ts` (compléter l'import en tête du
fichier avec `resoudreOrganisationActive` et `type DepotOrganisation`) :

```ts
describe("resoudreOrganisationActive", () => {
  const depotFactice = (appartenances: AppartenanceOrganisation[]) => {
    const ecritures: Array<[string, string]> = [];
    const depot: DepotOrganisation = {
      listerAppartenances: async () => appartenances,
      ecrireOrganisationActive: async (sessionId, organizationId) => {
        ecritures.push([sessionId, organizationId]);
      },
    };
    return { depot, ecritures };
  };

  it("rend l'organisation deja active sans rien lire ni ecrire", async () => {
    let lu = false;
    const depot: DepotOrganisation = {
      listerAppartenances: async () => {
        lu = true;
        return [];
      },
      ecrireOrganisationActive: async () => {},
    };

    const actif = await resoudreOrganisationActive(
      { id: "s1", userId: "u1", activeOrganizationId: "org-1" },
      depot,
    );

    expect(actif).toBe("org-1");
    expect(lu).toBe(false);
  });

  it("choisit et ecrit l'organisation quand la session n'en a pas", async () => {
    const { depot, ecritures } = depotFactice([
      { organizationId: "org-1", joinedAt: new Date("2026-01-01T00:00:00Z") },
    ]);

    const actif = await resoudreOrganisationActive(
      { id: "s1", userId: "u1", activeOrganizationId: null },
      depot,
    );

    expect(actif).toBe("org-1");
    expect(ecritures).toEqual([["s1", "org-1"]]);
  });

  it("reste a null et n'ecrit rien quand l'utilisateur n'a aucune organisation", async () => {
    const { depot, ecritures } = depotFactice([]);

    const actif = await resoudreOrganisationActive(
      { id: "s1", userId: "u1", activeOrganizationId: null },
      depot,
    );

    expect(actif).toBeNull();
    expect(ecritures).toEqual([]);
  });
});
```

- [ ] **Étape 2 : lancer les tests et vérifier qu'ils échouent**

Run: `npx vitest run lib/auth-organisation.test.ts`
Expected: FAIL — `resoudreOrganisationActive is not a function`

- [ ] **Étape 3 : écrire l'implémentation minimale**

Ajouter à `lib/auth-organisation.ts` :

```ts
export interface DepotOrganisation {
  listerAppartenances(userId: string): Promise<AppartenanceOrganisation[]>;
  ecrireOrganisationActive(sessionId: string, organizationId: string): Promise<void>;
}

/**
 * L'organisation active d'une session, resolue a la demande si elle manque.
 *
 * La migration ajoute activeOrganizationId a NULL sur les sessions deja
 * ouvertes. Les resoudre ici evite d'avoir a deconnecter tout le monde.
 */
export async function resoudreOrganisationActive(
  session: { id: string; userId: string; activeOrganizationId: string | null },
  depot: DepotOrganisation,
): Promise<string | null> {
  if (session.activeOrganizationId) return session.activeOrganizationId;

  const appartenances = await depot.listerAppartenances(session.userId);
  const choisie = choisirOrganisationActive(appartenances);
  if (!choisie) return null;

  await depot.ecrireOrganisationActive(session.id, choisie);
  return choisie;
}
```

- [ ] **Étape 4 : lancer les tests et vérifier qu'ils passent**

Run: `npx vitest run lib/auth-organisation.test.ts`
Expected: PASS — 8 tests

- [ ] **Étape 5 : commit**

Le dépôt concret qui implémente `DepotOrganisation` arrive en tâche 3, une fois
la colonne `Session.activeOrganizationId` créée — l'écrire ici ne compilerait
pas.

```bash
git add lib/auth-organisation.ts lib/auth-organisation.test.ts
git commit -m "feat(auth): resoudre l'organisation active des sessions anterieures"
```

---

## Tâche 3 : migration du schéma

**Files:**
- Modify: `prisma/schema.prisma:34-35` (relations `User`), `:44-56` (`Session`), `:241-281` (modèles organisation)
- Create: `prisma/migrations/<horodatage>_socle_organisation_better_auth/migration.sql`
- Create: `scripts/verifier-organisations.ts`

**Interfaces:**
- Consumes: rien.
- Produces: la colonne `Session.activeOrganizationId`, l'absence de `Organization.ownerId`, la nouvelle forme d'`OrganizationInvitation`. La tâche 4 en dépend.

**Contexte pour l'implémenteur.** L'ordre des opérations SQL est le cœur de
cette tâche. Supprimer `ownerId` avant d'avoir créé la ligne de membre
correspondante perdrait l'identité du propriétaire pour toute organisation dont
cette ligne manquerait. Prisma génère par défaut un `DROP COLUMN` sec : il faut
donc **écrire la migration à la main** plutôt que d'accepter celle qu'il
propose.

`OrganizationInvitation` n'est référencée par aucun fichier de `app/`,
`components/`, `lib/` ni `actions/` : la table est vide, on la remplace sans
précaution de reprise.

- [ ] **Étape 1 : modifier le schéma Prisma**

Dans `prisma/schema.prisma`, modèle `Session`, ajouter après `userAgent` :

```prisma
  activeOrganizationId String?
```

Modèle `Organization` — supprimer les deux lignes `ownerId` et `owner` :

```prisma
model Organization {
  id          String               @id @default(cuid())
  name        String
  slug        String               @unique
  description String?
  logo        String?
  members     OrganizationMember[]
  invitations OrganizationInvitation[]
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
}
```

Modèle `User` — supprimer la ligne 34, la relation `ownedOrganizations` n'ayant
plus de contrepartie :

```prisma
  ownedOrganizations      Organization[]         @relation("OwnedOrganizations")
```

Modèle `OrganizationInvitation` — remplacer entièrement par la forme du plugin :

```prisma
model OrganizationInvitation {
  id             String       @id @default(cuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  email          String
  role           String       @default("member")
  status         String       @default("pending")
  expiresAt      DateTime
  inviterId      String
  inviter        User         @relation("OrganizationInvitationsSent", fields: [inviterId], references: [id], onDelete: Cascade)
  createdAt      DateTime     @default(now())

  @@index([email])
  @@index([organizationId])
}
```

Modèle `User` — ajouter la contrepartie de `inviter`, à la place de la ligne
`ownedOrganizations` supprimée :

```prisma
  organizationInvitationsSent OrganizationInvitation[] @relation("OrganizationInvitationsSent")
```

- [ ] **Étape 2 : produire la migration sans l'appliquer**

Run: `npx prisma migrate dev --name socle_organisation_better_auth --create-only`
Expected: un dossier `prisma/migrations/<horodatage>_socle_organisation_better_auth/` contenant `migration.sql`.

- [ ] **Étape 3 : réécrire le SQL généré pour remplir avant de supprimer**

Ouvrir le `migration.sql` produit et le remplacer par ceci. Les noms de tables
sont ceux que Prisma génère par défaut, c'est-à-dire le nom du modèle tel quel,
entre guillemets.

```sql
-- 1. L'organisation active, nullable : aucune session existante n'est invalidee.
ALTER TABLE "Session" ADD COLUMN "activeOrganizationId" TEXT;

-- 2. Remplissage AVANT suppression. Toute organisation dont le proprietaire
--    n'a pas de ligne de membre en recoit une, construite depuis ownerId.
--    Sans effet si les donnees sont deja coherentes.
INSERT INTO "OrganizationMember" ("id", "organizationId", "userId", "role", "joinedAt")
SELECT gen_random_uuid()::text, o."id", o."ownerId", 'owner', o."createdAt"
FROM "Organization" o
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationMember" m
  WHERE m."organizationId" = o."id" AND m."role" = 'owner'
);

-- 3. L'information vit desormais dans OrganizationMember.
ALTER TABLE "Organization" DROP COLUMN "ownerId";

-- 4. Table jamais ecrite par aucun code : on la remplace par la forme du plugin.
DROP TABLE "OrganizationInvitation";

CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "inviterId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationInvitation_email_idx" ON "OrganizationInvitation"("email");
CREATE INDEX "OrganizationInvitation_organizationId_idx" ON "OrganizationInvitation"("organizationId");

ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Si le `migration.sql` généré contient une clause `DROP CONSTRAINT` sur
`Organization_ownerId_fkey`, la conserver et la placer **juste avant** l'étape 3.

- [ ] **Étape 3 bis : contrôle croisé de la liste des champs**

La spec exige que le plugin fasse foi sur sa propre forme. On ne peut pas
reprendre sa sortie telle quelle — elle nommerait les tables `member` et
`invitation` — mais on peut vérifier qu'aucun champ obligatoire ne manque.

Run: `npx @better-auth/cli@latest generate --config lib/auth.ts --output /tmp/better-auth-schema.prisma -y`

Comparer les champs des modèles produits avec ceux écrits à l'étape 1 :

| Modèle attendu | Champs obligatoires |
|---|---|
| `organization` | `name`, `slug`, `logo`, `createdAt`, `updatedAt` |
| `member` | `organizationId`, `userId`, `role`, `createdAt` (chez nous `joinedAt`) |
| `invitation` | `organizationId`, `email`, `role`, `status`, `expiresAt`, `inviterId`, `createdAt` |
| `session` | `activeOrganizationId` |

Tout champ obligatoire présent dans la sortie du CLI et absent de
`prisma/schema.prisma` doit être ajouté avant de continuer. La commande échoue
si le plugin n'est pas encore déclaré dans `lib/auth.ts` — c'est le cas à ce
stade : exécuter alors cette étape **après** la tâche 4, et corriger le schéma
si un écart apparaît.

- [ ] **Étape 4 : appliquer la migration**

Run: `npx prisma migrate dev`
Expected: `Your database is now in sync with your schema.`

- [ ] **Étape 4 bis : fournir le dépôt concret, adossé à Prisma**

`DepotOrganisation` (tâche 2) est une interface sans implémentation tant que
ceci n'existe pas. Elle vit dans un fichier séparé pour que
`lib/auth-organisation.ts` reste sans dépendance à Prisma — c'est ce qui rend
ses tests exécutables sans base.

Créer `lib/auth-organisation-prisma.ts` :

```ts
import { prisma } from "./prisma";
import type { DepotOrganisation } from "./auth-organisation";

export const depotOrganisationPrisma: DepotOrganisation = {
  listerAppartenances: (userId) =>
    prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true, joinedAt: true },
    }),

  ecrireOrganisationActive: async (sessionId, organizationId) => {
    await prisma.session.update({
      where: { id: sessionId },
      data: { activeOrganizationId: organizationId },
    });
  },
};
```

**Note pour l'implémenteur :** ce dépôt n'a volontairement pas encore
d'appelant. Son consommateur est le chantier 2, qui lira l'organisation active
pour rattacher un projet. Ne pas l'inliner ailleurs « pour qu'il serve ».

- [ ] **Étape 5 : écrire le script de contrôle post-migration**

Créer `scripts/verifier-organisations.ts` :

```ts
import { prisma } from "@/lib/prisma";

/**
 * Controle post-migration : l'identite du proprietaire a bien survecu au
 * passage de Organization.ownerId vers un membre de role owner.
 */
async function main() {
  const organisations = await prisma.organization.findMany({
    select: { id: true, name: true, members: { where: { role: "owner" }, select: { userId: true } } },
  });

  const orphelines = organisations.filter((o) => o.members.length === 0);

  console.log(`${organisations.length} organisation(s) verifiee(s)`);
  console.log(`${await prisma.organizationMember.count()} ligne(s) de membre`);

  if (orphelines.length > 0) {
    console.error(`ECHEC : ${orphelines.length} organisation(s) sans proprietaire`);
    orphelines.forEach((o) => console.error(`  - ${o.id} (${o.name})`));
    process.exit(1);
  }

  console.log("OK : chaque organisation a au moins un membre de role owner");
}

main().finally(() => prisma.$disconnect());
```

Ajouter le script dans `package.json`, à côté de `check:subscriptions` :

```json
    "check:organizations": "tsx scripts/verifier-organisations.ts",
```

- [ ] **Étape 6 : lancer le contrôle**

Run: `npm run check:organizations`
Expected: `OK : chaque organisation a au moins un membre de role owner`, code de sortie 0.

- [ ] **Étape 7 : vérifier que rien d'autre n'a cassé**

Run: `npx tsc --noEmit`
Expected: aucune sortie. Si `app/api/organizations/route.ts` signale `ownerId`
inconnu, c'est attendu — cette route est supprimée en tâche 5. La corriger
provisoirement en retirant `ownerId: session.user.id` de l'appel `create`.

- [ ] **Étape 8 : commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/auth-organisation-prisma.ts scripts/verifier-organisations.ts package.json app/api/organizations/route.ts
git commit -m "feat(db): preparer le schema pour le plugin organization"
```

---

## Tâche 4 : brancher le plugin côté serveur

**Files:**
- Modify: `lib/auth.ts:18` (`databaseHooks`), `:113` (`plugins`)
- Test: `lib/auth.organisation.test.ts`

**Interfaces:**
- Consumes: `choisirOrganisationActive` (tâche 1), le schéma migré (tâche 3).
- Produces: `auth` exposant les points d'entrée `/api/auth/organization/*`. La tâche 5 en dépend.

**Contexte pour l'implémenteur.** Les trois rôles livrés par le plugin
(`owner`, `admin`, `member`) reproduisent déjà exactement le `roleRank` écrit à
la main dans l'ancienne route : **ne définir aucun contrôle d'accès
personnalisé**. Les surcharges `modelName` et `fields` existent pour que le
plugin lise les tables actuelles sans les renommer.

- [ ] **Étape 1 : écrire le test qui échoue**

Créer `lib/auth.organisation.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { auth } from "./auth";

describe("configuration du plugin organization", () => {
  const plugin = auth.options.plugins?.find((p) => p.id === "organization");

  it("est branche", () => {
    expect(plugin).toBeDefined();
  });

  it("pointe sur la table OrganizationMember, qui n'est pas renommee", () => {
    const schema = (plugin as { options?: { schema?: Record<string, { modelName?: string }> } })
      .options?.schema;
    expect(schema?.member?.modelName).toBe("organizationMember");
    expect(schema?.invitation?.modelName).toBe("organizationInvitation");
  });

  it("lit joinedAt la ou le plugin attend createdAt", () => {
    const schema = (plugin as {
      options?: { schema?: { member?: { fields?: Record<string, string> } } };
    }).options?.schema;
    expect(schema?.member?.fields?.createdAt).toBe("joinedAt");
  });

  it("conserve le champ description propre a ce projet", () => {
    const schema = (plugin as {
      options?: { schema?: { organization?: { additionalFields?: Record<string, unknown> } } };
    }).options?.schema;
    expect(schema?.organization?.additionalFields).toHaveProperty("description");
  });
});
```

- [ ] **Étape 2 : lancer le test et vérifier qu'il échoue**

Run: `npx vitest run lib/auth.organisation.test.ts`
Expected: FAIL — `expected undefined to be defined` sur « est branche »

- [ ] **Étape 3 : déclarer le plugin**

Dans `lib/auth.ts`, compléter l'import de la ligne 3 :

```ts
import { emailOTP, organization, twoFactor } from "better-auth/plugins";
```

Ajouter en tête du fichier, après les imports :

```ts
import { choisirOrganisationActive } from "./auth-organisation";
```

Dans le tableau `plugins` (ligne 113), ajouter avant `emailOTP(...)` :

```ts
    organization({
      schema: {
        // Le plugin attend des tables 'member' et 'invitation' ; les notres
        // portent deja un nom, et renommer une table en production coute plus
        // cher que cette surcharge.
        member: {
          modelName: "organizationMember",
          fields: { createdAt: "joinedAt" },
        },
        invitation: { modelName: "organizationInvitation" },
        organization: {
          additionalFields: {
            description: { type: "string", required: false },
          },
        },
      },
    }),
```

- [ ] **Étape 4 : lancer le test et vérifier qu'il passe**

Run: `npx vitest run lib/auth.organisation.test.ts`
Expected: PASS — 4 tests

- [ ] **Étape 5 : poser l'organisation active à la connexion**

Dans `lib/auth.ts`, à l'intérieur de `databaseHooks` (ligne 18), ajouter une
clé `session` à côté de la clé `user` existante :

```ts
    session: {
      create: {
        before: async (session) => {
          const appartenances = await prisma.organizationMember.findMany({
            where: { userId: session.userId },
            select: { organizationId: true, joinedAt: true },
          });

          return {
            data: {
              ...session,
              activeOrganizationId: choisirOrganisationActive(appartenances),
            },
          };
        },
      },
    },
```

- [ ] **Étape 6 : vérifier le typage et la suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur de typage ; tous les tests passent.

- [ ] **Étape 7 : commit**

```bash
git add lib/auth.ts lib/auth.organisation.test.ts
git commit -m "feat(auth): brancher le plugin organization sur les tables existantes"
```

---

## Tâche 5 : passer l'interface sur le client better-auth

**Files:**
- Modify: `lib/auth-client.ts`
- Modify: `components/templates/organization-manager.tsx`
- Delete: `app/api/organizations/route.ts`, `app/api/organizations/[id]/members/route.ts`

**Interfaces:**
- Consumes: le plugin serveur (tâche 4).
- Produces: `authClient.organization.*` utilisable dans toute l'interface.

**Contexte pour l'implémenteur.** Le plugin expose déjà ses points d'entrée sous
`/api/auth/organization/*`, contrôles de rôle compris. Les deux routes faites
main deviennent des passe-plats redondants : on les supprime. Le composant lit
aujourd'hui `_count.members`, que la liste du plugin ne renvoie pas — le compte
vient de `getFullOrganization`, appelé par organisation.

- [ ] **Étape 1 : déclarer le plugin client**

Dans `lib/auth-client.ts`, compléter l'import :

```ts
import { emailOTPClient, organizationClient, twoFactorClient } from "better-auth/client/plugins";
```

Ajouter `organizationClient()` en tête du tableau `plugins` :

```ts
  plugins: [
    organizationClient(),
    emailOTPClient(),
    ...(isTwoFactorEnabled ? [twoFactorClient()] : []),
  ],
```

- [ ] **Étape 2 : lire le composant avant de le modifier**

Run: `sed -n 1,120p components/templates/organization-manager.tsx`

Repérer les quatre appels réseau à remplacer, aux lignes 41, 53, 72 et 92 :
`api.get("/api/organizations")`, `api.get("/api/organizations/{id}/members")`,
`api.post("/api/organizations", …)` et
`api.delete("/api/organizations/{id}/members", { userId })`.

- [ ] **Étape 3 : remplacer les quatre appels**

Correspondances, une pour une :

| Appel actuel | Remplacement |
|---|---|
| `api.get("/api/organizations")` | `authClient.organization.list()` |
| `api.get(\`/api/organizations/${orgId}/members\`)` | `authClient.organization.getFullOrganization({ query: { organizationId: orgId } })` puis lire `.members` |
| `api.post("/api/organizations", { name, description, slug })` | `authClient.organization.create({ name, slug, description })` |
| `api.delete(\`/api/organizations/${id}/members\`, { userId })` | `authClient.organization.removeMember({ memberIdOrEmail: userId, organizationId: id })` |

Remplacer l'import `import { api } from "@/lib/client"` par
`import { authClient } from "@/lib/auth-client"` si `api` n'est plus utilisé
ailleurs dans le fichier.

Le compte de membres est affiché à **deux endroits**, à traiter différemment :

- **Ligne 206**, `{members.length} member{…}` sur l'organisation ouverte : ce
  compte vient de l'état local `members`, alimenté par l'appel de la ligne 53.
  Il fonctionne tel quel une fois cet appel remplacé — **ne pas y toucher**.
- **Ligne 193**, `{org._count.members}` dans la liste : `organization.list()`
  ne renvoie pas ce compte, et appeler `getFullOrganization` par organisation
  juste pour l'afficher ferait N requêtes au chargement. **Supprimer cet
  affichage**, ainsi que le champ `_count` de l'interface `Organization`
  ligne 26. Le compte reste visible sur l'organisation ouverte, où il est exact.

Le plugin ne génère pas de `slug` automatiquement, contrairement à l'ancienne
route (`slugify` + suffixe horodaté en cas de collision,
`app/api/organizations/route.ts:24` et `:54-56`). Conserver cette fonction
`slugify` dans le composant et lui passer le résultat en `slug`, sinon la
création échouera dès qu'un nom contiendra un espace ou une majuscule.

- [ ] **Étape 4 : supprimer les routes devenues inutiles**

```bash
rm -r app/api/organizations
```

- [ ] **Étape 5 : vérifier qu'aucune référence ne subsiste**

Run: `grep -rn "/api/organizations" --include=*.ts --include=*.tsx . | grep -v node_modules`
Expected: aucune sortie.

- [ ] **Étape 6 : vérifier le typage et la suite complète**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur de typage ; tous les tests passent.

- [ ] **Étape 7 : vérification manuelle dans l'application**

Run: `npm run dev`, puis ouvrir `/organizations` connecté.

Vérifier, dans cet ordre :
1. La liste des organisations s'affiche.
2. Créer une organisation nommée « Mon Équipe Test » — le slug produit doit être `mon-equipe-test` et la création réussir.
3. Ouvrir cette organisation : la liste des membres affiche le créateur avec le rôle `owner`.
4. Avec un second compte de rôle `member`, le retrait d'un autre membre doit être refusé.

- [ ] **Étape 8 : commit**

```bash
git add lib/auth-client.ts components/templates/organization-manager.tsx
git add -A app/api
git commit -m "refactor(auth): passer l'interface des organisations sur le client better-auth"
```

---

## Vérification finale

- [ ] `npx tsc --noEmit` — aucune erreur
- [ ] `npm test` — toute la suite passe
- [ ] `npm run check:organizations` — chaque organisation a au moins un `owner`
- [ ] `grep -rn "/api/organizations" --include=*.ts --include=*.tsx . | grep -v node_modules` — aucune sortie
- [ ] `grep -rn "ownerId" prisma/schema.prisma` — aucune sortie
- [ ] Les huit critères d'acceptation de la spec sont satisfaits

---

## Suite

Le chantier 1 (stockage objet) ne dépend pas de celui-ci et peut démarrer en
parallèle. Le chantier 2 (`VideoProject`, `Scene`, verrou d'édition) dépend de
`session.activeOrganizationId` livré ici, et étendra les `statements` du plugin
avec une ressource `project`.
