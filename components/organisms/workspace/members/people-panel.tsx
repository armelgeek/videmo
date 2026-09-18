"use client";

import { UserMinus } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";
import { Member, PANEL, Role } from "./types";

interface PeoplePanelProps {
  members: Member[] | null | undefined;
  currentUserId?: string;
  myRole?: Role;
  canManage: boolean;
  ownerCount: number;
  busyId: string | null;
  assignableRoles: Role[];
  onUpdateRole: (member: Member, role: Role) => void;
  onRemoveMember: (member: Member) => void;
  className?: string;
}

export function PeoplePanel({
  members,
  currentUserId,
  myRole,
  canManage,
  ownerCount,
  busyId,
  assignableRoles,
  onUpdateRole,
  onRemoveMember,
  className,
}: PeoplePanelProps) {
  const memberCount = members?.length ?? 0;

  return (
    <section className={cn(PANEL, "p-0 overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-foreground">People</h2>
        <span className="text-xs text-muted-foreground font-medium">
          {memberCount} {memberCount === 1 ? "member" : "members"}
        </span>
      </div>

      {!members ? (
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
          {members.map((member) => {
            const isMe = member.userId === currentUserId;
            const isLastOwner = member.role === "owner" && ownerCount === 1;
            const canEditRole =
              canManage && !isMe && (member.role !== "owner" || myRole === "owner") && !isLastOwner;
            const displayName = member.user.name || member.user.email;

            return (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-3 px-6 py-4 transition-colors hover:bg-muted/10"
              >
                {member.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user avatar URL
                  <img
                    src={member.user.image}
                    alt=""
                    className="h-9 w-9 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-sm font-semibold text-foreground">
                    {displayName[0]?.toUpperCase()}
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                    {isMe && (
                      <span className="rounded border border-border bg-muted/60 px-1.5 py-0.2 text-[10px] font-semibold text-muted-foreground">
                        You
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                </div>

                {canEditRole ? (
                  <label>
                    <span className="sr-only">Role for {displayName}</span>
                    <select
                      value={member.role}
                      disabled={busyId === member.id}
                      onChange={(event) => onUpdateRole(member, event.target.value as Role)}
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
                      "rounded-full px-2.5 py-0.5 text-xs capitalize",
                      member.role === "owner"
                        ? "border-2 border-ink bg-highlight font-bold text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]"
                        : member.role === "admin"
                        ? "border border-border bg-muted/60 font-semibold text-foreground"
                        : "border border-border/60 bg-card text-muted-foreground font-medium",
                    )}
                  >
                    {member.role}
                  </span>
                )}

                {canEditRole && (
                  <IconButton
                    label={`Remove ${displayName}`}
                    disabled={busyId === member.id}
                    onClick={() => onRemoveMember(member)}
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
  );
}
