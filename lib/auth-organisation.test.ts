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
