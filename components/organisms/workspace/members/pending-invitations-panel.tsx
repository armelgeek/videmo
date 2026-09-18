"use client";

import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, Copy, Mail, RotateCw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";
import { Invitation, PANEL } from "./types";

interface PendingInvitationsPanelProps {
  invitations: Invitation[];
  busyId: string | null;
  onResend: (invitation: Invitation) => void;
  onCancel: (invitation: Invitation) => void;
}

export function PendingInvitationsPanel({
  invitations,
  busyId,
  onResend,
  onCancel,
}: PendingInvitationsPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  const copyLink = async (invitation: Invitation) => {
    await navigator.clipboard.writeText(`${window.location.origin}/invite/${invitation.id}`);
    setCopiedId(invitation.id);
    toast.success("Invite link copied");
    setTimeout(() => setCopiedId((current) => (current === invitation.id ? null : current)), 2000);
  };

  return (
    <section className={cn(PANEL, "p-0 overflow-hidden")}>
      <h2 className="border-b border-border px-6 py-4 text-sm font-semibold text-foreground">
        Pending invitations
        <span className="ml-2 text-muted-foreground">{invitations.length}</span>
      </h2>
      <ul className="divide-y divide-border">
        {invitations.map((invitation) => (
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
                  <Check className="h-4 w-4 text-foreground" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </IconButton>
              <IconButton
                label="Resend invitation"
                disabled={busyId === invitation.id}
                onClick={() => onResend(invitation)}
              >
                <RotateCw className={cn("h-4 w-4", busyId === invitation.id && "animate-spin")} />
              </IconButton>
              <IconButton
                label="Cancel invitation"
                disabled={busyId === invitation.id}
                onClick={() => onCancel(invitation)}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
