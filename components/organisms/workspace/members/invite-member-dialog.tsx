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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
            <Select
              value={inviteRole}
              onValueChange={(role) => setInviteRole(role as Role)}
            >
              <SelectTrigger id="invite-role" className="w-full capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((role) => (
                  <SelectItem key={role} value={role} className="capitalize">
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_HINTS[inviteRole]}.</p>
          </div>
        </form>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isInviting}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit()}
            disabled={isInviting || !email.trim()}
          >
            {isInviting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send invite
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
