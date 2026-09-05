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
