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
