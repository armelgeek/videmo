"use client";

import { useMemo, useState } from "react";
import { Crown, Loader2, Search, Shield, User, UserMinus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Hint } from "@/components/molecules/hint";
import { IconButton } from "./icon-button";
import { Member, PANEL, Role, ROLE_HINTS } from "./types";

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

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  member: User,
};

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
  const [search, setSearch] = useState("");

  const filteredMembers = useMemo(() => {
    if (!members) return [];
    const query = search.trim().toLowerCase();
    if (!query) return members;

    return members.filter((member) => {
      const name = (member.user.name ?? "").toLowerCase();
      const email = member.user.email.toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [members, search]);

  const totalCount = members?.length ?? 0;

  return (
    <section className={cn(PANEL, "p-0 overflow-hidden", className)}>
      {/* Header with Title, Count and Search */}
      <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">People</h2>
          <Badge variant="outline" className="text-xs font-medium">
            {totalCount} {totalCount === 1 ? "member" : "members"}
          </Badge>
        </div>

        {totalCount > 0 && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              className="h-8 pl-8 pr-8 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading Skeletons */}
      {!members ? (
        <ul className="divide-y divide-border" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-4 px-6 py-4">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </li>
          ))}
        </ul>
      ) : filteredMembers.length === 0 ? (
        /* Empty Search State */
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
            <Search className="size-5" />
          </div>
          <p className="mt-3 text-sm font-semibold text-foreground">No members found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No member matched &ldquo;{search}&rdquo;. Try another search term.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSearch("")}
            className="mt-4"
          >
            Clear search
          </Button>
        </div>
      ) : (
        /* Members List */
        <ul className="divide-y divide-border">
          {filteredMembers.map((member) => {
            const isMe = member.userId === currentUserId;
            const isLastOwner = member.role === "owner" && ownerCount === 1;
            const canEditRole =
              canManage && !isMe && (member.role !== "owner" || myRole === "owner") && !isLastOwner;
            const displayName = member.user.name || member.user.email;
            const initials = (displayName[0] || "?").toUpperCase();
            const isBusy = busyId === member.id;
            const RoleIcon = ROLE_ICONS[member.role] ?? User;

            return (
              <li
                key={member.id}
                className={cn(
                  "flex flex-wrap items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/10",
                  isBusy && "opacity-60 pointer-events-none",
                )}
              >
                {/* Avatar with initials fallback */}
                <Avatar className="size-10 border border-border shadow-xs">
                  {member.user.image && (
                    <AvatarImage src={member.user.image} alt={displayName} />
                  )}
                  <AvatarFallback className="bg-accent font-semibold text-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Member Identity & Email */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                    {isMe && (
                      <Badge
                        variant="outline"
                        className="border-highlight/50 bg-highlight/10 px-1.5 py-0 text-[10px] font-semibold text-highlight-foreground"
                      >
                        You
                      </Badge>
                    )}
                    {member.role === "owner" && (
                      <Hint label={ROLE_HINTS.owner}>
                        <span className="inline-flex text-highlight">
                          <Crown className="size-3.5 fill-highlight/20" />
                        </span>
                      </Hint>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                </div>

                {/* Role Selector or Badge */}
                <div className="flex items-center gap-2">
                  {canEditRole ? (
                    <Select
                      value={member.role}
                      disabled={isBusy}
                      onValueChange={(role) => onUpdateRole(member, role as Role)}
                    >
                      <SelectTrigger size="sm" className="h-8 gap-2 capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        {assignableRoles.map((role) => {
                          const Icon = ROLE_ICONS[role] ?? User;
                          return (
                            <SelectItem key={role} value={role} className="capitalize">
                              <div className="flex items-center gap-2">
                                <Icon className="size-3.5 text-muted-foreground" />
                                <span>{role}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Hint label={ROLE_HINTS[member.role]}>
                      <Badge
                        variant={
                          member.role === "owner"
                            ? "secondary"
                            : member.role === "admin"
                            ? "default"
                            : "outline"
                        }
                        className="gap-1 capitalize cursor-help"
                      >
                        <RoleIcon className="size-3" />
                        {member.role}
                      </Badge>
                    </Hint>
                  )}

                  {/* Remove action */}
                  {canEditRole && (
                    <IconButton
                      label={`Remove ${displayName}`}
                      disabled={isBusy}
                      onClick={() => onRemoveMember(member)}
                    >
                      {isBusy ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <UserMinus className="size-4" />
                      )}
                    </IconButton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
