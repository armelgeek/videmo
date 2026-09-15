"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertCircle, Check, Copy, Loader2, Mail, RotateCw, UserMinus, X } from "lucide-react";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ORGANIZATION_CHANGED_EVENT,
  notifyOrganizationChanged,
} from "@/lib/app-shell/organization-events";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Role = "owner" | "admin" | "member";

interface Member {
  id: string;
  userId: string;
  role: Role;
  user: { name: string | null; email: string; image: string | null };
}

interface Invitation {
  id: string;
  email: string;
  role: Role;
  status: string;
  expiresAt: string | Date;
}

interface FullOrganization {
  id: string;
  name: string;
  members: Member[];
  invitations: Invitation[];
}

interface Confirmation {
  title: string;
  description: string;
  action: string;
  run: () => Promise<boolean>;
}

const ROLE_HINTS: Record<Role, string> = {
  owner: "Everything, including roles and deleting the organization",
  admin: "Manage members and delete projects",
  member: "Create and edit projects",
};

const PANEL = "rounded-lg border-2 border-ink bg-card p-6 shadow-[5px_5px_0_hsl(var(--offset))]";

export function MembersView() {
  const router = useRouter();
  const { data: session } = useSession();
  const [organization, setOrganization] = useState<FullOrganization | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [isInviting, setIsInviting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await authClient.organization.getFullOrganization();
    if (error || !data) {
      setLoadError(error?.message ?? "Members could not be loaded.");
      return;
    }
    setLoadError(null);
    setOrganization(data as unknown as FullOrganization);
  }, []);

  useEffect(() => {
    load();
    const onChange = () => {
      setOrganization(null);
      load();
    };
    window.addEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(ORGANIZATION_CHANGED_EVENT, onChange);
  }, [load]);

  const me = organization?.members.find((member) => member.userId === session?.user.id);
  const myRole = me?.role;
  const canManage = myRole === "owner" || myRole === "admin";
  const ownerCount = organization?.members.filter((member) => member.role === "owner").length ?? 0;
  const pendingInvitations =
    organization?.invitations.filter(
      (invitation) => invitation.status === "pending" && new Date(invitation.expiresAt) > new Date(),
    ) ?? [];
  const assignableRoles: Role[] = myRole === "owner" ? ["member", "admin", "owner"] : ["member", "admin"];

  const invite = async (event: React.FormEvent, resend = false) => {
    event.preventDefault();
    const target = email.trim().toLowerCase();
    if (!target || !organization) return;
    setIsInviting(true);
    const { error } = await authClient.organization.inviteMember({
      email: target,
      role: inviteRole,
      organizationId: organization.id,
      resend,
    });
    setIsInviting(false);
    if (error) {
      toast.error(error.message ?? "Invitation could not be sent.");
      return;
    }
    toast.success(`Invitation sent to ${target}`);
    setEmail("");
    load();
  };

  const withBusy = async (id: string, run: () => Promise<{ error: { message?: string } | null }>, success: string) => {
    setBusyId(id);
    const { error } = await run();
    setBusyId(null);
    if (error) {
      toast.error(error.message ?? "That didn't work. Try again.");
      return false;
    }
    toast.success(success);
    load();
    return true;
  };

  const copyLink = async (invitation: Invitation) => {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${invitation.id}`);
    setCopiedId(invitation.id);
    toast.success("Invite link copied");
    setTimeout(() => setCopiedId((current) => (current === invitation.id ? null : current)), 2000);
  };

  const runConfirmation = async () => {
    if (!confirmation) return;
    setIsConfirming(true);
    const ok = await confirmation.run();
    setIsConfirming(false);
    if (ok) setConfirmation(null);
  };

  if (loadError && !organization) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className={cn(PANEL, "text-center")}>
          <AlertCircle className="mx-auto h-6 w-6 text-foreground" />
          <p className="mt-3 font-medium text-foreground">Members could not be loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
          <button
            type="button"
            onClick={load}
            className="mt-5 rounded-lg border-2 border-ink bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border px-6 py-4 sm:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-1">
            {organization?.name ?? " "}
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            <span className="sk-marker">Members</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {organization
              ? `${organization.members.length} ${organization.members.length === 1 ? "person" : "people"} can open this organization's projects`
              : "Loading members…"}
          </p>
        </div>
      </header>

      <div className="flex-1 px-6 py-4 sm:px-8">
        <div className="space-y-6">
          {canManage && (
            <section className={cn(PANEL, "space-y-4")}>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Invite people</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  They get an email with a link that works for 48 hours.
                </p>
              </div>
              <form onSubmit={invite} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
                <div className="grid gap-1.5">
                  <label htmlFor="invite-email" className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="teammate@company.com"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="invite-role" className="text-xs font-medium text-muted-foreground">Role</label>
                  <select
                    id="invite-role"
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value as Role)}
                    className="h-10 rounded-lg border-2 border-ink bg-card px-3 text-sm capitalize shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition focus-visible:shadow-[3px_3px_0_hsl(var(--highlight))]"
                  >
                    {assignableRoles.map((role) => (
                      <option key={role} value={role} className="bg-card capitalize">
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isInviting || !email.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-50"
                >
                  {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Invite
                </button>
              </form>
              <p className="text-xs text-muted-foreground">{ROLE_HINTS[inviteRole]}.</p>
            </section>
          )}

          {canManage && pendingInvitations.length > 0 && (
            <section className={cn(PANEL, "p-0 overflow-hidden")}>
              <h2 className="border-b border-border px-6 py-4 text-sm font-semibold text-foreground">
                Pending invitations
                <span className="ml-2 text-muted-foreground">{pendingInvitations.length}</span>
              </h2>
              <ul className="divide-y divide-border">
                {pendingInvitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="capitalize">{invitation.role}</span> · expires{" "}
                        {formatDistanceToNowStrict(new Date(invitation.expiresAt), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <IconButton label="Copy invite link" onClick={() => copyLink(invitation)}>
                        {copiedId === invitation.id ? (
                          <Check className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </IconButton>
                      <IconButton
                        label="Resend invitation"
                        disabled={busyId === invitation.id}
                        onClick={() =>
                          withBusy(
                            invitation.id,
                            () =>
                              authClient.organization.inviteMember({
                                email: invitation.email,
                                role: invitation.role,
                                organizationId: organization?.id,
                                resend: true,
                              }),
                            `Invitation resent to ${invitation.email}`,
                          )
                        }
                      >
                        <RotateCw className={cn("h-4 w-4", busyId === invitation.id && "animate-spin")} />
                      </IconButton>
                      <IconButton
                        label="Cancel invitation"
                        disabled={busyId === invitation.id}
                        onClick={() =>
                          withBusy(
                            invitation.id,
                            () => authClient.organization.cancelInvitation({ invitationId: invitation.id }),
                            `Cancelled the invitation to ${invitation.email}`,
                          )
                        }
                      >
                        <X className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={cn(PANEL, "p-0 overflow-hidden")}>
            <h2 className="border-b border-border px-6 py-4 text-sm font-semibold text-foreground">People</h2>
            {!organization ? (
              <ul className="divide-y divide-border" aria-busy="true">
                {[0, 1, 2].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-6 py-4">
                    <div className="h-9 w-9 rounded-full bg-card motion-safe:animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded bg-accent motion-safe:animate-pulse" />
                      <div className="h-3 w-1/2 rounded bg-card motion-safe:animate-pulse" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="divide-y divide-border">
                {organization.members.map((member) => {
                  const isMe = member.userId === session?.user.id;
                  const isLastOwner = member.role === "owner" && ownerCount === 1;
                  const canEditRole =
                    canManage && !isMe && (member.role !== "owner" || myRole === "owner") && !isLastOwner;
                  const displayName = member.user.name || member.user.email;

                  return (
                    <li key={member.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                      {member.user.image ? (
                        <img src={member.user.image} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-foreground">
                          {displayName[0]?.toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {displayName}
                          {isMe && <span className="ml-2 text-xs font-normal text-muted-foreground">You</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                      </div>

                      {canEditRole ? (
                        <label>
                          <span className="sr-only">Role for {displayName}</span>
                          <select
                            value={member.role}
                            disabled={busyId === member.id}
                            onChange={(event) => {
                              const role = event.target.value as Role;
                              withBusy(
                                member.id,
                                () =>
                                  authClient.organization.updateMemberRole({
                                    memberId: member.id,
                                    role,
                                    organizationId: organization.id,
                                  }),
                                `${displayName} is now ${role}`,
                              );
                            }}
                            className="h-8 rounded-lg border-2 border-ink bg-card px-2 text-xs capitalize shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition focus-visible:shadow-[3px_3px_0_hsl(var(--highlight))] disabled:opacity-50"
                          >
                            {assignableRoles.map((role) => (
                              <option key={role} value={role} className="bg-card capitalize">
                                {role}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
                            member.role === "owner"
                              ? "bg-gradient-to-r from-highlight/25 to-highlight/10 text-foreground"
                              : "bg-card text-muted-foreground",
                          )}
                        >
                          {member.role}
                        </span>
                      )}

                      {canEditRole && (
                        <IconButton
                          label={`Remove ${displayName}`}
                          onClick={() =>
                            setConfirmation({
                              title: `Remove ${displayName}?`,
                              description: `They lose access to ${organization.name} and its projects. Projects they created stay.`,
                              action: "Remove member",
                              run: () =>
                                withBusy(
                                  member.id,
                                  () =>
                                    authClient.organization.removeMember({
                                      memberIdOrEmail: member.id,
                                      organizationId: organization.id,
                                    }),
                                  `Removed ${displayName}`,
                                ),
                            })
                          }
                        >
                          <UserMinus className="h-4 w-4" />
                        </IconButton>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {organization && me && (
            <section className={cn(PANEL, "flex flex-wrap items-center justify-between gap-4")}>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Leave organization</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {myRole === "owner" && ownerCount === 1
                    ? "You're the only owner. Make someone else owner before leaving."
                    : "You lose access to its projects until someone invites you again."}
                </p>
              </div>
              <button
                type="button"
                disabled={myRole === "owner" && ownerCount === 1}
                onClick={() =>
                  setConfirmation({
                    title: `Leave ${organization.name}?`,
                    description: "You lose access to its projects until someone invites you again.",
                    action: "Leave organization",
                    run: async () => {
                      const { error } = await authClient.organization.leave({ organizationId: organization.id });
                      if (error) {
                        toast.error(error.message ?? "Could not leave the organization.");
                        return false;
                      }
                      toast.success(`Left ${organization.name}`);
                      notifyOrganizationChanged();
                      router.push("/workspace");
                      router.refresh();
                      return true;
                    },
                  })
                }
                className="rounded-lg border-2 border-ink px-4 py-2 text-sm font-semibold text-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-50"
              >
                Leave
              </button>
            </section>
          )}
        </div>
      </div>

      <AlertDialog open={Boolean(confirmation)} onOpenChange={(open) => !open && setConfirmation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirming}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirming}
              onClick={(event) => {
                event.preventDefault();
                runConfirmation();
              }}
              className="border-2 border-ink bg-highlight text-highlight-foreground hover:bg-highlight"
            >
              {isConfirming ? "Working…" : confirmation?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IconButton({
  label,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...props}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground outline-none transition hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-highlight disabled:opacity-40"
    >
      {children}
    </button>
  );
}
