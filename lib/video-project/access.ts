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
