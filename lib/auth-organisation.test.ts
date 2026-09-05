import { describe, expect, it } from "vitest";
import {
  choisirOrganisationActive,
  resoudreOrganisationActive,
  type AppartenanceOrganisation,
  type DepotOrganisation,
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
