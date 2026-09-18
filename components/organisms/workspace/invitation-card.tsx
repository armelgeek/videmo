"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InvitationCardProps {
  invitationId: string;
  signedInEmail: string;
}

type InvitationState =
  | "loading"
  | "ready"
  | "processing"
  | "success"
  | "error-expired"
  | "error-email-mismatch"
  | "error-not-verified"
  | "error-already-member"
  | "error-not-found";

const CARD_STYLE =
  "rounded-xl border-2 border-ink bg-card shadow-[5px_5px_0_hsl(var(--offset))]";

export function InvitationCard({ invitationId, signedInEmail }: InvitationCardProps) {
  const router = useRouter();
  const [state, setState] = useState<InvitationState>("loading");
  const [invitationDetails, setInvitationDetails] = useState<{
    organizationName: string;
    invitedEmail: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitation();
  }, [invitationId]);

  const loadInvitation = async () => {
    try {
      setState("loading");
      const res = await api.get(`/api/organizations/invitations/${invitationId}`);

      if (!res.ok) {
        if (res.error?.includes("expired")) {
          setState("error-expired");
          setError("This invitation link has expired. Please ask the organization admin to send a new one.");
        } else if (res.error?.includes("not found")) {
          setState("error-not-found");
          setError("Invitation not found. Please check the link and try again.");
        } else {
          setState("error-not-found");
          setError(res.error || "Could not load invitation details.");
        }
        return;
      }

      const details = res.data as { organizationName: string; invitedEmail: string };
      setInvitationDetails(details);

      if (details.invitedEmail !== signedInEmail) {
        setState("error-email-mismatch");
        setError(
          `This invitation was sent to ${details.invitedEmail}, but you're signed in as ${signedInEmail}. Please sign out and sign in with the correct email.`
        );
      } else {
        setState("ready");
      }
    } catch (err) {
      setState("error-not-found");
      setError("An unexpected error occurred. Please try again later.");
    }
  };

  const handleAcceptInvitation = async () => {
    if (state !== "ready") return;

    setState("processing");
    try {
      const res = await api.post(`/api/organizations/invitations/${invitationId}`, {});

      if (!res.ok) {
        if (res.error?.includes("not verified")) {
          setState("error-not-verified");
          setError(
            "Your email address must be verified before joining an organization. Please check your email and verify your address, then try again."
          );
        } else if (res.error?.includes("already member")) {
          setState("error-already-member");
          setError("You are already a member of this organization.");
        } else if (res.error?.includes("expired")) {
          setState("error-expired");
          setError("This invitation has expired. Please ask for a new one.");
        } else {
          setState("error-not-found");
          setError(res.error || "Failed to accept invitation. Please try again.");
        }
        return;
      }

      setState("success");
      toast.success("Invitation accepted! Redirecting to workspace...");
      setTimeout(() => {
        router.push("/workspace");
      }, 1500);
    } catch (err) {
      setState("error-not-found");
      setError("An unexpected error occurred. Please try again later.");
    }
  };

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/invite/${invitationId}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invitation link copied to clipboard");
  };

  if (state === "loading") {
    return (
      <Card className={CARD_STYLE}>
        <CardHeader>
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">Loading invitation details...</p>
        </CardContent>
      </Card>
    );
  }

  if (state === "success") {
    return (
      <Card className={CARD_STYLE}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border-2 border-ink bg-highlight text-highlight-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
              <CheckCircle className="h-4 w-4" />
            </span>
            Invitation Accepted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">
            Welcome to <strong>{invitationDetails?.organizationName}</strong>! Redirecting you to the workspace...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={CARD_STYLE}>
      <CardHeader>
        <CardTitle className="text-xl font-bold">You've been invited to an organization</CardTitle>
        <CardDescription>
          {invitationDetails
            ? `You were invited to join: ${invitationDetails.organizationName}`
            : "Loading invitation details..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error States */}
        {error && (
          <Alert className="border-2 border-ink bg-muted/20 text-foreground shadow-[2px_2px_0_hsl(var(--offset))]">
            <AlertCircle className="h-4 w-4 text-foreground" />
            <AlertDescription className="text-xs font-medium text-foreground">{error}</AlertDescription>
          </Alert>
        )}

        {/* Ready / Processing State */}
        {(state === "ready" || state === "processing") && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              You're signed in as <strong>{signedInEmail}</strong>. Click below to accept this invitation.
            </p>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleAcceptInvitation}
                disabled={state === "processing"}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border-2 border-ink bg-highlight px-4 text-sm font-bold text-highlight-foreground shadow-[3px_3px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px disabled:opacity-50"
              >
                {state === "processing" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  "Accept Invitation"
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex h-10 w-full items-center justify-center rounded-lg border-2 border-ink bg-card px-4 text-sm font-semibold text-foreground shadow-[2px_2px_0_hsl(var(--offset))] transition-transform hover:-translate-x-px hover:-translate-y-px"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Invitation Link
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Not the right account?{" "}
              <a href="/logout" className="font-semibold text-foreground underline underline-offset-2 hover:text-muted-foreground">
                Sign out
              </a>{" "}
              and sign in with a different email.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
