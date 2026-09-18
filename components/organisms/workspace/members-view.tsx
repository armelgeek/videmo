"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Mail, MoreVertical, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { SketchHint } from "@/components/molecules/sketch-hint";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  ORGANIZATION_CHANGED_EVENT,
  notifyOrganizationChanged,
} from "@/lib/app-shell/organization-events";

import {
  BrandPanel,
  Confirmation,
  FullOrganization,
  Invitation,
  InviteMemberDialog,
  Member,
  PANEL,
  PendingInvitationsPanel,
  PeoplePanel,
  Role,
} from "./members";

export function MembersView() {
  const router = useRouter();
  const { data: session } = useSession();
  const [organization, setOrganization] = useState<FullOrganization | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
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

  const withBusy = async (
    id: string,
    run: () => Promise<{ error: { message?: string } | null }>,
    success: string,
  ) => {
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

  const handleInvite = async (targetEmail: string, inviteRole: Role) => {
    if (!organization) return false;
    const { error } = await authClient.organization.inviteMember({
      email: targetEmail.toLowerCase(),
      role: inviteRole,
      organizationId: organization.id,
      resend: false,
    });
    if (error) {
      toast.error(error.message ?? "Invitation could not be sent.");
      return false;
    }
    toast.success(`Invitation sent to ${targetEmail}`);
    load();
    return true;
  };

  const handleUpdateRole = (member: Member, newRole: Role) => {
    if (!organization) return;
    const displayName = member.user.name || member.user.email;
    withBusy(
      member.id,
      () =>
        authClient.organization.updateMemberRole({
          memberId: member.id,
          role: newRole,
          organizationId: organization.id,
        }),
      `${displayName} is now ${newRole}`,
    );
  };

  const handleRemoveMember = (member: Member) => {
    if (!organization) return;
    const displayName = member.user.name || member.user.email;
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
    });
  };

  const handleResendInvitation = (invitation: Invitation) => {
    if (!organization) return;
    withBusy(
      invitation.id,
      () =>
        authClient.organization.inviteMember({
          email: invitation.email,
          role: invitation.role,
          organizationId: organization.id,
          resend: true,
        }),
      `Invitation resent to ${invitation.email}`,
    );
  };

  const handleCancelInvitation = (invitation: Invitation) => {
    withBusy(
      invitation.id,
      () => authClient.organization.cancelInvitation({ invitationId: invitation.id }),
      `Cancelled the invitation to ${invitation.email}`,
    );
  };

  const handleLeaveOrganization = () => {
    if (!organization) return;
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
    });
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
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-4 sm:px-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground mb-1">
            {organization?.name ?? " "}
          </p>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold text-foreground">
              <span className="sk-marker">Members</span>
            </h1>
            <SketchHint direction="left" className="hidden text-lg sm:flex">
              invite teammates to write and animate together
            </SketchHint>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {organization
              ? `${organization.members.length} ${organization.members.length === 1 ? "person" : "people"} can open this organization's projects`
              : "Loading members…"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManage && organization?.members.length === 1 && (
            <SketchHint direction="right" className="mr-1 hidden text-lg md:flex">
              videos go faster with a teammate
            </SketchHint>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] outline-none transition-transform hover:-translate-x-px hover:-translate-y-px focus-visible:ring-2 focus-visible:ring-highlight"
            >
              <Mail className="h-4 w-4" />
              Invite member
            </button>
          )}
          {organization && me && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-border text-muted-foreground outline-none transition hover:border-ink hover:text-foreground focus-visible:ring-2 focus-visible:ring-highlight"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {myRole === "owner" && ownerCount === 1 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Make someone else owner first
                  </div>
                ) : (
                  <DropdownMenuItem
                    onClick={handleLeaveOrganization}
                    className="text-destructive focus:text-destructive"
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Leave organization
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <div className="flex-1 px-6 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {canManage && (
            <PendingInvitationsPanel
              invitations={pendingInvitations}
              busyId={busyId}
              onResend={handleResendInvitation}
              onCancel={handleCancelInvitation}
            />
          )}

          {canManage && organization && (
            <BrandPanel
              key={organization.id}
              organizationId={organization.id}
              initialLogo={organization.logo ?? null}
              onLogoChange={(newLogo) => {
                setOrganization((current) => (current ? { ...current, logo: newLogo } : null));
              }}
            />
          )}

          <PeoplePanel
            className="lg:col-span-2"
            members={organization?.members}
            currentUserId={session?.user.id}
            myRole={myRole}
            canManage={canManage}
            ownerCount={ownerCount}
            busyId={busyId}
            assignableRoles={assignableRoles}
            onUpdateRole={handleUpdateRole}
            onRemoveMember={handleRemoveMember}
          />
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

      {canManage && (
        <InviteMemberDialog
          open={isInviteOpen}
          onOpenChange={setIsInviteOpen}
          assignableRoles={assignableRoles}
          onInvite={handleInvite}
        />
      )}
    </div>
  );
}
