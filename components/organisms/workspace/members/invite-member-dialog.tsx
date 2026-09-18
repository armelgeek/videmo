"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Role, ROLE_HINTS } from "./types";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignableRoles: Role[];
  onInvite: (email: string, role: Role) => Promise<boolean>;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  assignableRoles,
  onInvite,
}: InviteMemberDialogProps) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [isInviting, setIsInviting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const target = email.trim();
    if (!target) return;

    setIsInviting(true);
    const success = await onInvite(target, inviteRole);
    setIsInviting(false);

    if (success) {
      setEmail("");
      setInviteRole("member");
      onOpenChange(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Invite member</AlertDialogTitle>
          <AlertDialogDescription>
            Send an invitation to join your organization. They'll get an email with a link that works for 48 hours.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-1.5">
            <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
              Email
            </label>
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
            <label htmlFor="invite-role" className="text-sm font-medium text-foreground">
              Role
            </label>
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
            <p className="text-xs text-muted-foreground">{ROLE_HINTS[inviteRole]}.</p>
          </div>
        </form>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isInviting}>Cancel</AlertDialogCancel>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={isInviting || !email.trim()}
            className="inline-flex items-center gap-2 rounded-lg border-2 border-ink bg-highlight px-4 py-2 text-sm font-semibold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-50"
          >
            {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Send invite
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
