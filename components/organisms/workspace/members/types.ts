export type Role = "owner" | "admin" | "member";

export interface Member {
  id: string;
  userId: string;
  role: Role;
  user: { name: string | null; email: string; image: string | null };
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: string;
  expiresAt: string | Date;
}

export interface FullOrganization {
  id: string;
  name: string;
  logo?: string | null;
  members: Member[];
  invitations: Invitation[];
}

export interface Confirmation {
  title: string;
  description: string;
  action: string;
  run: () => Promise<boolean>;
}

export const ROLE_HINTS: Record<Role, string> = {
  owner: "Everything, including roles and deleting the organization",
  admin: "Manage members and delete projects",
  member: "Create and edit projects",
};

export const PANEL = "rounded-lg border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))]";
