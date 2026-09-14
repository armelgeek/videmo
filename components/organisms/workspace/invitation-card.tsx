"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

interface InvitationDetails {
  organizationName: string;
  inviterEmail: string;
  role: string;
  email: string;
  expiresAt: string | Date;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; invitation: InvitationDetails }
  | { kind: "wrong-recipient" }
  | { kind: "unavailable"; message: string };

export function InvitationCard({
  invitationId,
  signedInEmail,
}: {
  invitationId: string;
  signedInEmail: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    authClient.organization.getInvitation({ query: { id: invitationId } }).then(({ data, error }) => {
      if (data) {
        setState({ kind: "ready", invitation: data as unknown as InvitationDetails });
      } else if (error?.status === 403 && /recipient/i.test(error.message ?? "")) {
        setState({ kind: "wrong-recipient" });
      } else {
        setState({
          kind: "unavailable",
          message:
            error?.status === 403
              ? error.message ?? "Verify your email address before accepting."
              : "This invitation was already used, cancelled, or has expired. Ask the person who invited you for a new one.",
        });
      }
    });
  }, [invitationId]);

  const respond = async (action: "accept" | "decline") => {
    if (state.kind !== "ready") return;
    setPending(action);
    const { error } =
      action === "accept"
        ? await authClient.organization.acceptInvitation({ invitationId })
        : await authClient.organization.rejectInvitation({ invitationId });
    if (error) {
      setPending(null);
      toast.error(error.message ?? "Something went wrong. Try again.");
      return;
    }
    toast.success(
      action === "accept"
        ? `Joined ${state.invitation.organizationName}`
        : `Declined the invitation to ${state.invitation.organizationName}`,
    );
    router.push("/workspace");
    router.refresh();
  };

  const switchAccount = async () => {
    await authClient.signOut();
    router.push(`/login?redirect=${encodeURIComponent(`/invite/${invitationId}`)}`);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
      {state.kind === "loading" && (
        <div className="flex flex-col items-center py-8 text-gray-400" aria-busy="true">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="mt-3 text-sm">Checking your invitation…</p>
        </div>
      )}

      {state.kind === "ready" && (
        <>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-violet-500 text-xl font-bold text-white">
            {(state.invitation.organizationName.trim()[0] ?? "?").toUpperCase()}
          </span>
          <h1 className="mt-5 text-2xl font-bold text-white">Join {state.invitation.organizationName}</h1>
          <p className="mt-2 text-sm text-gray-400">
            {state.invitation.inviterEmail} invited you as{" "}
            <span className="font-medium text-gray-200">{state.invitation.role}</span>. You&apos;ll see and
            edit this organization&apos;s video projects.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Expires {formatDistanceToNowStrict(new Date(state.invitation.expiresAt), { addSuffix: true })}
          </p>
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => respond("decline")}
              disabled={pending !== null}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {pending === "decline" ? "Declining…" : "Decline"}
            </button>
            <button
              type="button"
              onClick={() => respond("accept")}
              disabled={pending !== null}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-rose-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white outline-none transition hover:shadow-lg hover:shadow-rose-500/20 focus-visible:ring-2 focus-visible:ring-rose-300 disabled:opacity-50"
            >
              {pending === "accept" && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending === "accept" ? "Joining…" : "Accept and join"}
            </button>
          </div>
        </>
      )}

      {state.kind === "wrong-recipient" && (
        <>
          <AlertCircle className="mx-auto h-7 w-7 text-amber-400" />
          <h1 className="mt-4 text-xl font-bold text-white">This invitation is for another email</h1>
          <p className="mt-2 text-sm text-gray-400">
            You&apos;re signed in as <span className="text-gray-200">{signedInEmail}</span>. Switch to the account
            the invitation was sent to.
          </p>
          <button
            type="button"
            onClick={switchAccount}
            className="mt-8 w-full rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90"
          >
            Sign in with another account
          </button>
        </>
      )}

      {state.kind === "unavailable" && (
        <>
          <AlertCircle className="mx-auto h-7 w-7 text-rose-400" />
          <h1 className="mt-4 text-xl font-bold text-white">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-gray-400">{state.message}</p>
          <Link
            href="/workspace"
            className="mt-8 inline-block w-full rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            Go to projects
          </Link>
        </>
      )}
    </div>
  );
}
