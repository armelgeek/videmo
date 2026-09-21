/**
 * Who may curate the organization's brand kit.
 *
 * Kept apart from `library-access`, which reaches for the database: this half
 * is a pure predicate, so a client component can ask the question without
 * pulling Prisma into the browser bundle.
 */
const CURATOR_ROLES = ["owner", "admin"];

export function canCurateLibrary(role: string | null | undefined): boolean {
  return !!role && CURATOR_ROLES.includes(role);
}

export const LIBRARY_FORBIDDEN =
  "Only organization owners and admins can change formats and styles";
